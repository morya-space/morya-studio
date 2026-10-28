import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { config, flushPromises, shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { reactive } from 'vue'
import { MSelect, message } from 'morya-ui'
import DataPanel from '../panels/DataPanel.vue'
import FieldBuilderPanel from '../panels/FieldBuilderPanel.vue'
import PanelTabs from '../components/PanelTabs.vue'
import CardNode from '../../components/cards/CardNode.vue'
import { useEditorStore } from '../store'
import { registerBuiltinCards } from '../../components/cards'
import { saveDataSource } from '../../services/datasource'
import { plain } from '../plain'
import type { DataConfigDraft } from '../panels/dataDraft'
import type { CardSchema } from '../../types/schema'
import type { RoleAssignment, FilterCondition } from '../../engine/data-binding'

/**
 * 数据配置弹窗（草稿模式）装配链路集成测试：
 * 过滤条件 / 聚合装配 → 推导 transform 与绑定 → 草稿 → 预览行。
 * mock 适配器有 300ms 模拟延迟，用 fake timers 推进。
 */

// stub 组件渲染默认插槽：MFormItem 等容器内的控件（如引用数据源 MSelect）才能被 findComponent 命中
config.global.renderStubDefaultSlot = true

/** 推进 mock 取数延迟并等待所有微任务（预览数据就绪） */
async function settlePreview() {
  await vi.advanceTimersByTimeAsync(400)
  await flushPromises()
}

function makeDraft(card: Record<string, unknown>): DataConfigDraft {
  return reactive({
    dataSource: card.dataSource ? plain(card.dataSource) : undefined,
    dataSourceId: card.dataSourceId as string | undefined,
    bindings: {},
    computedFields: card.computedFields ? plain(card.computedFields) : [],
    transform: card.transform ? plain(card.transform) : [],
  }) as DataConfigDraft
}

describe('DataPanel 装配链路（草稿模式）', () => {
  let pinia: Pinia

  beforeEach(() => {
    vi.useFakeTimers()
    pinia = createPinia()
    setActivePinia(pinia)
    registerBuiltinCards()
    // saveDataSource 的后端同步在测试环境必然失败（仅内存缓存生效），抑制告警噪音
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  function mountPanel(type = 'chart', draftInit: Partial<DataConfigDraft> = {}) {
    const editorStore = useEditorStore()
    editorStore.newPage('test')
    const cardId = editorStore.addCard(type)
    const card = editorStore.page.cards.find(c => c.id === cardId)!
    // 保持 reactive（与生产一致：PropertiesPanel 用 ref 包装），展开拷贝会丢响应性导致 draft watcher 不触发
    const draft = Object.assign(makeDraft(card as unknown as Record<string, unknown>), draftInit)
    const wrapper = shallowMount(DataPanel, {
      props: { draft },
      global: {
        plugins: [pinia],
        stubs: {
          // 手动 stub 并渲染插槽，让列内容（FieldBuilderPanel / 预览表格）挂载
          MScrollbar: { template: '<div><slot /></div>' },
        },
      },
    })
    return { wrapper, draft, cardId }
  }

  /** 数据内容区切到表格页签（默认「预览」页签下表格不渲染）；第一个 PanelTabs 是左列来源页签，第二个是数据内容视图 */
  async function switchToTableTab(wrapper: ReturnType<typeof mountPanel>['wrapper']) {
    wrapper.findAllComponents(PanelTabs)[1].vm.$emit('update:modelValue', 'table')
    await flushPromises()
  }

  it('数据内容默认「预览」页签：渲染当前组件（编辑态绑定 + 加工后数据）', async () => {
    const { wrapper, draft } = mountPanel('chart')
    await settlePreview()

    // 「预览」为第一个页签且默认选中
    const contentTabs = wrapper.findAllComponents(PanelTabs)[1]
    expect((contentTabs.props('options') as { value: string }[]).map(o => o.value)).toEqual(['preview', 'table', 'json'])
    expect(contentTabs.props('modelValue')).toBe('preview')

    // 预览经 CardNode 渲染当前组件：data 为加工后行，card 为应用草稿绑定后的副本
    const node = wrapper.findComponent(CardNode)
    expect(node.exists()).toBe(true)
    const staticData = (draft.dataSource as { staticData: Record<string, unknown>[] }).staticData
    expect(node.props('data')).toHaveLength(staticData.length)

    // 装配编辑实时作用于预览：绑定写入卡片副本，加工后行数随聚合收敛到维度去重数
    wrapper.findComponent(FieldBuilderPanel).vm.$emit('update:assignments', [
      { path: 'chart.xField', multiple: false, fields: [{ field: 'x', agg: 'none' }] },
      { path: 'chart.yField', multiple: true, fields: [{ field: 'y', agg: 'sum' }] },
      { path: 'chart.seriesField', multiple: false, fields: [] },
    ])
    await flushPromises()

    const previewSchema = node.props('card') as CardSchema
    expect(previewSchema.chart?.xField).toBe('x')
    expect(node.props('data')).toHaveLength(new Set(staticData.map(r => String(r.x))).size)
  })

  it('过滤条件：更新 filters 后推导 filter 步骤写入草稿 transform', async () => {
    const { wrapper, draft } = mountPanel('chart')
    await settlePreview()

    const fb = wrapper.findComponent(FieldBuilderPanel)
    expect(fb.exists()).toBe(true)

    const filters: FilterCondition[] = [{ field: 'x', op: '==', value: '一月' }]
    fb.vm.$emit('update:filters', filters)
    await flushPromises()

    expect(draft.transform).toEqual([{ op: 'filter', expr: 'x == "一月"' }])
  })

  it('过滤条件作用于预览行（数据内容区行数随之减少）', async () => {
    const { wrapper, draft } = mountPanel('chart')
    await settlePreview()
    await switchToTableTab(wrapper)

    const before = wrapper.findAll('.dcontent__table tbody tr').length
    expect(before).toBe(6)

    // mock 模板的字段值为随机生成，取数据中的真实值构造条件
    const staticData = (draft.dataSource as { staticData: Record<string, unknown>[] }).staticData
    const firstX = String(staticData[0].x)
    wrapper.findComponent(FieldBuilderPanel).vm.$emit('update:filters', [{ field: 'x', op: '==', value: firstX }])
    await flushPromises()

    const expected = staticData.filter(r => String(r.x) === firstX).length
    const after = wrapper.findAll('.dcontent__table tbody tr').length
    expect(after).toBe(expected)
  })

  it('聚合装配：维度原始值 + 数值求和 → groupBy 步骤与别名绑定', async () => {
    const { wrapper, draft } = mountPanel('chart')
    await settlePreview()

    const next: RoleAssignment[] = [
      { path: 'chart.xField', multiple: false, fields: [{ field: 'x', agg: 'none' }] },
      { path: 'chart.yField', multiple: true, fields: [{ field: 'y', agg: 'sum' }] },
      { path: 'chart.seriesField', multiple: false, fields: [] },
    ]
    wrapper.findComponent(FieldBuilderPanel).vm.$emit('update:assignments', next)
    await flushPromises()

    expect(draft.transform).toEqual([{ op: 'groupBy', field: 'x', aggs: { y_sum: 'sum' } }])
    expect(draft.bindings['chart.xField']).toBe('x')
    expect(draft.bindings['chart.yField']).toEqual(['y_sum'])
  })

  it('重开弹窗不丢手写 transform 步骤（sort / limit 等表达式模式追加的步骤应保留）', async () => {
    const { draft } = mountPanel('chart', {
      transform: [
        { op: 'filter', expr: 'x == "一月"' },
        { op: 'sort', field: 'y', order: 'desc' },
      ],
    } as Partial<DataConfigDraft>)
    await settlePreview()

    // 打开弹窗（还原装配）不应把用户手写/表达式模式追加的步骤抹掉
    expect(draft.transform).toEqual([
      { op: 'filter', expr: 'x == "一月"' },
      { op: 'sort', field: 'y', order: 'desc' },
    ])
  })

  it('表格卡的入参区包含「表格列」角色（dataContract 需声明 field 路径）', async () => {
    const { wrapper } = mountPanel('table')
    await settlePreview()

    const fb = wrapper.findComponent(FieldBuilderPanel)
    expect(fb.exists()).toBe(true)
    const roles = fb.props('roles') as { field: string }[]
    expect(roles.length).toBeGreaterThan(0)
    expect(roles[0].field).toBe('table.columns')
  })

  it('表格列装配写入字段名数组（TableCard 侧规格化为列对象）', async () => {
    const { wrapper, draft } = mountPanel('table')
    await settlePreview()

    wrapper.findComponent(FieldBuilderPanel).vm.$emit('update:assignments', [
      { path: 'table.columns', multiple: true, fields: [{ field: 'x', agg: 'none' }, { field: 'y', agg: 'none' }] },
    ])
    await flushPromises()

    expect(draft.bindings['table.columns']).toEqual(['x', 'y'])
  })

  it('中文字段名的过滤条件生效（表达式引擎支持 Unicode 标识符）', async () => {
    const { wrapper, draft } = mountPanel('chart', {
      dataSource: {
        type: 'mock',
        staticData: [
          { 城市: '北京', 销量: 100 },
          { 城市: '上海', 销量: 200 },
          { 城市: '北京', 销量: 150 },
        ],
      },
    })
    await settlePreview()
    await switchToTableTab(wrapper)

    expect(wrapper.findAll('.dcontent__table tbody tr').length).toBe(3)

    wrapper.findComponent(FieldBuilderPanel).vm.$emit('update:filters', [{ field: '城市', op: '==', value: '北京' }])
    await flushPromises()

    expect(draft.transform).toEqual([{ op: 'filter', expr: '城市 == "北京"' }])
    expect(wrapper.findAll('.dcontent__table tbody tr').length).toBe(2)
  })

  it('换引数据源：整体重置草稿配置（计算列 / 加工 / 绑定），并自动拉取新源预览', async () => {
    await saveDataSource({ id: 'ds-a', name: '源A', type: 'mock', staticData: [{ x: '一月', y: 1 }] })
    await saveDataSource({ id: 'ds-b', name: '源B', type: 'mock', staticData: [{ x: '二月', y: 2 }] })

    const { wrapper, draft } = mountPanel('chart', {
      dataSource: undefined,
      dataSourceId: 'ds-a',
      computedFields: [{ name: 'c', expr: 'row.y * 2' }],
    })
    await settlePreview()
    await switchToTableTab(wrapper)

    // 旧源上已有装配绑定与加工
    wrapper.findComponent(FieldBuilderPanel).vm.$emit('update:assignments', [
      { path: 'chart.xField', multiple: false, fields: [{ field: 'x', agg: 'none' }] },
      { path: 'chart.yField', multiple: true, fields: [{ field: 'y', agg: 'sum' }] },
      { path: 'chart.seriesField', multiple: false, fields: [] },
    ])
    await flushPromises()
    expect(draft.bindings['chart.xField']).toBe('x')
    expect(draft.transform).toEqual([{ op: 'groupBy', field: 'x', aggs: { y_sum: 'sum' } }])
    expect(wrapper.text()).toContain('一月')

    // 换引另一个数据源（引用模式下左列仅有这一个 MSelect）
    wrapper.findComponent(MSelect).vm.$emit('update:modelValue', 'ds-b')
    await settlePreview()

    // 整体重置：引用更新，计算列 / 加工 / 绑定清空
    expect(draft.dataSourceId).toBe('ds-b')
    expect(draft.computedFields).toBeUndefined()
    expect(draft.transform).toEqual([])
    expect(draft.bindings['chart.xField']).toBeUndefined()
    // 预览自动切换为新数据源内容
    expect(wrapper.text()).toContain('二月')
    expect(wrapper.text()).not.toContain('一月')
  })

  it('引用数据源的计算列进入预览，卡片上仍可编辑计算列', async () => {
    await saveDataSource({
      id: 'ds-cf',
      name: '带计算列',
      type: 'mock',
      staticData: [{ x: '一月', y: 2 }],
      computedFields: [{ name: 'double', expr: 'y * 2' }],
    })
    const { wrapper } = mountPanel('chart', { dataSource: undefined, dataSourceId: 'ds-cf' })
    await settlePreview()
    await switchToTableTab(wrapper)

    expect(wrapper.text()).toContain('计算列在左侧数据表中编辑')
    expect(wrapper.text()).toContain('double')
    expect(wrapper.text()).toContain('4')
  })

  it('切换接入类型不再弹出 message 提示', async () => {
    const infoSpy = vi.spyOn(message, 'info')
    const { wrapper } = mountPanel('chart')
    await settlePreview()

    // 左列来源页签（第一个 PanelTabs）：Mock → 请求
    wrapper.findAllComponents(PanelTabs)[0].vm.$emit('update:modelValue', 'api')
    await flushPromises()

    expect(infoSpy).not.toHaveBeenCalled()
  })

  it('引用数据源：「数值」装配为数组绑定后，健康提示不再误报「入参未绑定字段」', async () => {
    await saveDataSource({ id: 'ds-a', name: '源A', type: 'mock', staticData: [{ x: '一月', y: 1 }] })

    const { wrapper, draft } = mountPanel('chart', { dataSource: undefined, dataSourceId: 'ds-a' })
    await settlePreview()

    const fb = wrapper.findComponent(FieldBuilderPanel)

    // 换引/切换来源后的重置态：必绑角色提示未绑定
    fb.vm.$emit('update:assignments', [
      { path: 'chart.xField', multiple: false, fields: [] },
      { path: 'chart.yField', multiple: true, fields: [] },
      { path: 'chart.seriesField', multiple: false, fields: [] },
    ])
    await flushPromises()
    expect(wrapper.text()).toContain('入参未绑定字段')

    // 重新装配：数值角色（multiple）写入数组绑定，提示应消除
    fb.vm.$emit('update:assignments', [
      { path: 'chart.xField', multiple: false, fields: [{ field: 'x', agg: 'none' }] },
      { path: 'chart.yField', multiple: true, fields: [{ field: 'y', agg: 'none' }] },
      { path: 'chart.seriesField', multiple: false, fields: [] },
    ])
    await flushPromises()

    expect(draft.bindings['chart.yField']).toEqual(['y'])
    expect(wrapper.text()).not.toContain('入参未绑定字段')
  })
})
