<script setup lang="ts">
/**
 * 数据配置弹窗（v0.4）
 * 五类来源：动态请求 / Mock（固定数据或模板生成）/ WebSocket / SQL / 引用数据源
 * 布局：左列 = 来源切换 + 连接配置（滚动）+ 测试结果（固定列底），
 * 右列 = 绑定数据；数据内容（组件预览 / 表格 / JSON）在「组件数据入参」右侧入参区下方。
 * 切换接入类型会整体重置为该类型的默认状态；草稿模式点「完成」才提交生效。
 */

import { computed, ref, watch } from 'vue'
import { MButton, MFileUpload, MFormItem, MInput, MInputNumber, MSelect, MSegmented, MTag, MTextarea, message, MCard, MDivider } from 'morya-ui'
import { useEditorStore } from '../store'
import { useDataStore } from '../../data/store'
import { listDataSources } from '../../services/datasource'
import { getAdapter } from '../../data/adapters'
import { getByPath } from '../../data/adapters/base'
import type { TestResult } from '../../data/adapters/base'
import type { CardSchema, ComputedField, DataSourceConfig, DataSourceType, HttpMethod, RequestBodyType } from '../../types/schema'
import type { DataRole } from '../../engine/data-role'
import { getCardRegistration } from '../../engine/registry'
import {
  buildAssignments,
  deriveBindings,
  deriveTransform,
  parseFilterConditions,
  validateDataBindings,
  type BindingIssue,
  type FilterCondition,
  type RoleAssignment,
} from '../../engine/data-binding'
import { inferFieldProfiles } from '../../data/field-profile'
import PanelTabs from '../components/PanelTabs.vue'
import KeyValueTable from '../components/KeyValueTable.vue'
import CardNode from '../../components/cards/CardNode.vue'
import FieldBuilderPanel from './FieldBuilderPanel.vue'
import DataResultPanel from './DataResultPanel.vue'
import { plain } from '../plain'
import { defaultMockTemplateFor } from '../../components/cards/mocks'
import { formatMockTemplate, generateMockRows } from '../../data/mockgen'
import { parseFileText } from '../../services/connector'
import { applyComputedFields, applyTransform } from '../../data/transform/pipeline'
import type { DataConfigDraft } from './dataDraft'
import type { TransformStep } from '../../types/schema'

const store = useEditorStore()
const dataStore = useDataStore()

/**
 * 草稿模式：属性面板的「数据配置」弹窗传入 draft，
 * 所有编辑只写草稿，点「完成」由弹窗统一提交（弹窗外仍走 store）。
 */
const props = defineProps<{ draft?: DataConfigDraft }>()

const card = computed(() => store.selectedCard)
/** 当前生效的数据源 / 引用（草稿优先） */
const activeDataSource = computed(() => (props.draft ? props.draft.dataSource : card.value?.dataSource))
const activeDataSourceId = computed(() => (props.draft ? props.draft.dataSourceId : card.value?.dataSourceId))

type SourceMode = 'api' | 'mock' | 'websocket' | 'sql' | 'reference'

const SOURCE_TABS = [
  { label: '请求', value: 'api' },
  { label: 'Mock', value: 'mock' },
  { label: 'WebSocket', value: 'websocket' },
  { label: 'SQL', value: 'sql' },
  { label: '引用', value: 'reference' },
]

const MODE_TYPE: Record<Exclude<SourceMode, 'reference'>, DataSourceType> = {
  api: 'api',
  mock: 'mock',
  websocket: 'websocket',
  sql: 'sql',
}

const mode = computed<SourceMode>(() => {
  const c = card.value
  if (!c) return 'mock'
  if (activeDataSourceId.value) return 'reference'
  const t = activeDataSource.value?.type
  return (t && t in MODE_TYPE ? t : 'mock') as SourceMode
})

const inlineDs = computed<DataSourceConfig>(() => activeDataSource.value ?? { type: 'mock', staticData: [] })

function patchDs(patch: Partial<DataSourceConfig>): void {
  const next = { ...plain(inlineDs.value), ...plain(patch) } as DataSourceConfig
  if (props.draft) {
    props.draft.dataSource = next
    return
  }
  if (!card.value) return
  store.updateCardField(card.value.id, 'dataSource', next)
}

/**
 * 切换接入类型：整体重置为该类型的默认状态（不保留旧配置）。
 * 草稿模式下仅写草稿，点「完成」才正式提交；取消/关闭则丢弃。
 */
function setMode(next: SourceMode): void {
  const c = card.value
  if (!c || next === mode.value) return
  if (next === 'reference') {
    const saved = listDataSources().filter(d => d.id)
    if (!saved.length) {
      message.warn('还没有数据源，请先在「数据源」页面创建')
      return
    }
    resetSourceState({ dataSourceId: activeDataSourceId.value ?? saved[0].id })
    return
  }
  resetSourceState({ dataSource: defaultSourceConfig(next) })
}

/** 各接入类型的默认配置（Mock 默认固定数据，与新建卡片一致） */
function defaultSourceConfig(next: Exclude<SourceMode, 'reference'>): DataSourceConfig {
  switch (next) {
    case 'api':
      return { type: 'api', method: 'GET' }
    case 'mock': {
      const template = card.value ? defaultMockTemplateFor(card.value.type) : ''
      return { type: 'mock', staticData: template ? generateMockRows(template) : [] }
    }
    case 'websocket':
      return { type: 'websocket', ws: { aggregate: 'first' } }
    case 'sql':
      return { type: 'sql', sql: { driver: 'mysql', host: '', port: 3306, query: '', limit: 1000 } }
  }
}

/** 切换类型的整体重置：连接配置 + 测试结果 + 装配绑定 + 预览数据 */
function resetSourceState(patch: { dataSource?: DataSourceConfig; dataSourceId?: string }): void {
  const c = card.value
  if (!c) return

  // ① 连接配置与草稿态字段（计算列 / 数据加工 / 绑定）
  if (props.draft) {
    props.draft.dataSource = patch.dataSource
    props.draft.dataSourceId = patch.dataSourceId
    props.draft.computedFields = undefined
    props.draft.transform = undefined
    // 显式写入 undefined，确保点「完成」提交时覆盖卡片上的旧绑定
    const bindings: Record<string, unknown> = {}
    for (const role of dataRoles.value) bindings[role.field] = undefined
    props.draft.bindings = bindings
  } else {
    store.updateCardFields(c.id, {
      dataSource: patch.dataSource,
      dataSourceId: patch.dataSourceId,
      computedFields: undefined,
      transform: undefined,
    })
  }

  // ② 测试结果回到未测状态
  result.value = null

  // ③ 装配状态清空（触发推导 watcher，同步清空 transform 与字段绑定）
  assignments.value = dataRoles.value.map(role => ({ path: role.field, multiple: Boolean(role.multiple), fields: [] }))
  filterConds.value = []

  // ④ 预览数据：Mock 立即生成预览；引用由 dataSourceId watcher 自动拉取；其余等「测试」
  if (patch.dataSource?.type === 'mock') void loadDraftRows()
  else if (!patch.dataSourceId) draftRows.value = []
}

/** 来源页签（PanelTabs 需要 string） */
const modeTab = computed({
  get: () => mode.value as string,
  set: (v: string) => setMode(v as SourceMode),
})

function str(key: 'url' | 'dataPath' | 'body' | 'mockTemplate' | 'wsUrl') {
  return computed<string>({
    get: () => (inlineDs.value[key] as string | undefined) ?? '',
    set: v => patchDs({ [key]: v } as Partial<DataSourceConfig>),
  })
}

// ==================== Mock 数据 ====================
const mockTemplate = str('mockTemplate')

/** 固定数据（JSON）—— Mock 的另一种数据方式
 *  本地编辑缓冲：非法 JSON 不打断输入、仅标记错误（预览/测试/提交沿用最近一次合法数据）；
 *  合法输入即时同步配置。外部变更（导入/格式化/切换来源）经 watch 等价比较后刷新缓冲。 */
const staticInput = ref('')
const staticInvalid = ref(false)

function syncStaticInput(): void {
  staticInput.value = JSON.stringify(inlineDs.value.staticData ?? [], null, 2)
  staticInvalid.value = false
}

function onStaticInput(v: string): void {
  staticInput.value = v
  try {
    const parsed = JSON.parse(v || '[]')
    staticInvalid.value = false
    patchDs({ staticData: Array.isArray(parsed) ? parsed : [parsed] })
  } catch {
    staticInvalid.value = true
  }
}

watch(() => inlineDs.value.staticData, (data) => {
  // 与当前缓冲等价（用户输入触发的回写）则跳过，避免打字过程中被重排
  try {
    if (JSON.stringify(JSON.parse(staticInput.value || '[]')) === JSON.stringify(data ?? [])) return
  } catch { /* 缓冲非法：用户正在输入，交由显式同步（导入/格式化）处理 */ return }
  syncStaticInput()
}, { immediate: true })

/** Mock 数据方式二选一：固定数据（默认）/ 模板生成（由配置字段推导） */
const MOCK_MODE_OPTIONS = [
  { label: '固定数据', value: 'static' },
  { label: '模板生成', value: 'template' },
]
const mockModeTab = computed({
  get: (): 'template' | 'static' => (inlineDs.value.mockTemplate !== undefined ? 'template' : 'static'),
  set: (v: string) => {
    const c = card.value
    if (v === 'template') {
      patchDs({
        staticData: undefined,
        mockTemplate: inlineDs.value.mockTemplate ?? (c ? defaultMockTemplateFor(c.type) : ''),
      })
    } else {
      // 切到固定数据：保留已有静态数据；没有则快照当前模板（或组件默认模板）生成的数据
      const tpl = inlineDs.value.mockTemplate
      const defaultTpl = c ? defaultMockTemplateFor(c.type) : ''
      const seed = inlineDs.value.staticData
        ?? (tpl?.trim() ? generateMockRows(tpl) : undefined)
        ?? (defaultTpl ? generateMockRows(defaultTpl) : undefined)
        ?? []
      patchDs({ mockTemplate: undefined, staticData: seed })
    }
  },
})

/** 美化 Mock 模板（保留 {{repeat N}} 前缀；非法 JSON 原样保留） */
function formatMockTemplateText() {
  const tpl = inlineDs.value.mockTemplate
  if (!tpl) return
  patchDs({ mockTemplate: formatMockTemplate(tpl) })
  message.success('已格式化')
}

/** Mock 固定数据编辑态非法（预览 / 测试 / 提交均沿用最近一次合法数据） */
const mockStaticInvalid = computed(() => mode.value === 'mock' && mockModeTab.value === 'static' && staticInvalid.value)

/** 美化 Mock 固定数据 JSON（直接整理编辑缓冲；非法 JSON 不覆盖用户输入） */
function formatMockStatic() {
  try {
    const parsed = JSON.parse(staticInput.value || '[]')
    const rows = Array.isArray(parsed) ? parsed : [parsed]
    staticInput.value = JSON.stringify(rows, null, 2)
    staticInvalid.value = false
    patchDs({ staticData: rows })
    message.success('已格式化')
  } catch {
    message.error('JSON 格式错误，无法格式化')
  }
}

/** Mock 固定数据：从文件导入（JSON / CSV / TSV），解析结果替换静态数据 */
async function importMockStatic(files: File[]): Promise<void> {
  const file = files[0]
  if (!file) return
  try {
    const rows = parseFileText(file.name, await file.text())
    if (!rows.length) {
      message.warn('未解析到数据行，请确认是有效的 JSON / CSV 文件')
      return
    }
    patchDs({ staticData: rows })
    syncStaticInput()
    // 草稿模式：导入后立即刷新右侧预览（本地数据，无需点「测试」）
    if (props.draft) void loadDraftRows()
    message.success(`已导入 ${rows.length} 行数据`)
  } catch {
    message.error('文件解析失败，请检查文件格式')
  }
}

// ==================== 动态请求 ====================
const METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(v => ({ label: v, value: v }))
const BODY_TYPE_OPTIONS = [
  { label: '无', value: 'none' },
  { label: 'JSON', value: 'json' },
  { label: 'form', value: 'form' },
]
const REQUEST_TABS = [
  { label: 'Params', value: 'params' },
  { label: 'Headers', value: 'headers' },
  { label: 'Body', value: 'body' },
]
const requestTab = ref<string>('params')

const method = computed<string>({
  get: () => inlineDs.value.method ?? 'GET',
  set: v => patchDs({ method: v as HttpMethod }),
})
const url = str('url')
const dataPath = str('dataPath')
const params = computed<Record<string, string>>({
  get: () => (inlineDs.value.params ?? {}) as Record<string, string>,
  set: v => patchDs({ params: v }),
})
const headers = computed<Record<string, string>>({
  get: () => inlineDs.value.headers ?? {},
  set: v => patchDs({ headers: v }),
})
const bodyType = computed<string>({
  get: () => inlineDs.value.bodyType ?? 'none',
  set: v => patchDs({ bodyType: v as RequestBodyType }),
})
const body = str('body')
const timeoutMs = computed<number>({
  get: () => inlineDs.value.timeoutMs ?? 0,
  set: v => patchDs({ timeoutMs: Math.max(0, Number(v) || 0) }),
})

const retryCount = computed({
  get: () => inlineDs.value.retry?.count ?? 0,
  set: (v: number) => patchDs({ retry: { count: Math.max(0, Number(v) || 0), delayMs: inlineDs.value.retry?.delayMs ?? 500 } }),
})
const retryDelay = computed({
  get: () => inlineDs.value.retry?.delayMs ?? 500,
  set: (v: number) => patchDs({ retry: { count: inlineDs.value.retry?.count ?? 0, delayMs: Math.max(0, Number(v) || 0) } }),
})

// 认证
const authType = computed({
  get: () => inlineDs.value.auth?.type ?? 'none',
  set: (v: string) => patchDs({ auth: { ...(inlineDs.value.auth ?? { type: 'none' }), type: v as 'none' | 'bearer' | 'apikey' | 'basic' } }),
})
function patchAuth(patch: Partial<NonNullable<DataSourceConfig['auth']>>) {
  patchDs({ auth: { ...(inlineDs.value.auth ?? { type: 'none' }), ...plain(patch) } })
}

// 轮询间隔（存 ms）+ 单位
type IntervalUnit = 'second' | 'minute' | 'hour'
const INTERVAL_OPTIONS = [
  { label: '秒', value: 'second' },
  { label: '分', value: 'minute' },
  { label: '时', value: 'hour' },
]
const INTERVAL_FACTOR: Record<IntervalUnit, number> = { second: 1000, minute: 60000, hour: 3600000 }
const intervalUnit = ref<IntervalUnit>('second')
const pollInterval = computed<number>({
  get: () => Math.round((inlineDs.value.pollInterval ?? 0) / INTERVAL_FACTOR[intervalUnit.value]),
  set: (v: number) => patchDs({ pollInterval: Math.max(0, Number(v) || 0) * INTERVAL_FACTOR[intervalUnit.value] }),
})

/** 打开弹窗 / 切换卡片时按已存间隔推断显示单位（3600000ms 展示为 1 时而非 3600 秒） */
watch(() => [props.draft, card.value?.id] as const, () => {
  const ms = inlineDs.value.pollInterval ?? 0
  intervalUnit.value = ms > 0 && ms % 3600000 === 0 ? 'hour' : ms > 0 && ms % 60000 === 0 ? 'minute' : 'second'
}, { immediate: true })

// ==================== WebSocket ====================
const wsUrl = str('wsUrl')
const wsMessagePath = computed({
  get: () => inlineDs.value.ws?.messagePath ?? '',
  set: (v: string) => patchDs({ ws: { ...(inlineDs.value.ws ?? { aggregate: 'first' }), messagePath: v || undefined } }),
})
const wsAggregate = computed({
  get: () => inlineDs.value.ws?.aggregate ?? 'first',
  set: (v: string) => patchDs({ ws: { ...(inlineDs.value.ws ?? {}), aggregate: v as 'first' | 'append' | 'replace' } }),
})

// ==================== SQL ====================
const SQL_DEFAULT_PORT: Record<string, number> = { mysql: 3306, postgresql: 5432, sqlserver: 1433 }
const sql = computed(() => inlineDs.value.sql ?? { driver: 'mysql' as const, host: '', port: 3306, query: '', limit: 1000 })
function patchSql(patch: Record<string, unknown>) {
  patchDs({ sql: { ...plain(sql.value), ...plain(patch) } as DataSourceConfig['sql'] })
}

/** 切换数据库类型：端口仍是某驱动默认值时跟随新驱动；用户自定义过的端口保留 */
function onSqlDriverChange(driver: string): void {
  const patch: Record<string, unknown> = { driver }
  if (Object.values(SQL_DEFAULT_PORT).includes(sql.value.port ?? 3306)) {
    patch.port = SQL_DEFAULT_PORT[driver] ?? 3306
  }
  patchSql(patch)
}

// ==================== 引用数据源 ====================
const dataSourceId = computed({
  get: () => activeDataSourceId.value ?? '',
  set: (v: string) => {
    const next = v || undefined
    if (next === activeDataSourceId.value) return
    // 换引数据源：字段结构随之变化，与切换接入类型一致整体重置（连接配置 / 计算列 / 加工 / 绑定 / 测试结果）
    resetSourceState({ dataSourceId: next })
  },
})
const savedDataSourceOptions = computed(() => [
  { label: '（未选择）', value: '' },
  ...listDataSources().map(ds => ({ label: `${ds.name ?? ds.id} · ${ds.type}`, value: ds.id ?? '' })),
])
const referenced = computed(() => listDataSources().find(d => d.id === activeDataSourceId.value) ?? null)
function openDataSources() {
  window.open('/datasources', '_blank')
}

// ==================== 测试 ====================
const testing = ref(false)
const result = ref<TestResult | null>(null)

const testConfig = computed<DataSourceConfig | null>(() => {
  if (mode.value === 'reference') return referenced.value
  return { ...plain(inlineDs.value), type: MODE_TYPE[mode.value] }
})

async function runTest() {
  // 固定数据非法 JSON：拦截并明示，避免用旧数据测试通过造成误导
  if (mockStaticInvalid.value) {
    result.value = { ok: false, message: '固定数据不是合法的 JSON，请修正后再测试' }
    return
  }
  const cfg = testConfig.value
  if (!cfg || !card.value) return
  const adapter = getAdapter(cfg.type)
  testing.value = true
  result.value = null
  try {
    result.value = adapter.test
      ? await adapter.test(plain(cfg))
      : { ok: true, message: '该类型暂不支持测试' }
  } catch (e) {
    result.value = { ok: false, message: e instanceof Error ? e.message : String(e) }
  } finally {
    testing.value = false
  }
  if (!result.value?.ok) return
  if (props.draft) {
    // 草稿模式：只刷新弹窗内预览，不写回卡片（点「完成」才生效）。
    // 测试即取数：优先复用测试返回的完整数据行，避免二次请求，保证预览与测试结果同源。
    if (result.value.rows) draftRows.value = result.value.rows
    else await loadDraftRows()
  } else {
    // 非草稿：测试后同步刷新卡片数据（画布/预览即时生效）
    try { await dataStore.refreshCard(card.value) } catch { /* ignore */ }
  }
}

// ==================== 草稿预览（弹窗内，不写回 store） ====================
const draftRows = ref<Record<string, unknown>[]>([])
const sampleLoading = ref(false)

async function loadDraftRows(): Promise<void> {
  const cfg = testConfig.value
  if (!cfg) { draftRows.value = []; return }
  sampleLoading.value = true
  try {
    const adapter = getAdapter(cfg.type)
    draftRows.value = adapter.fetch ? await adapter.fetch(plain(cfg)) : []
  } catch (e) {
    // 自动拉取（打开弹窗 / 换引数据源）失败也要给出反馈，否则预览静默为空无从排查
    draftRows.value = []
    message.error(e instanceof Error ? e.message : '数据加载失败')
  } finally {
    sampleLoading.value = false
  }
}

watch(
  () => props.draft,
  async (d) => {
    draftRows.value = []
    if (!d) return
    // 本地类型（mock/static）打开即预览；网络类型点「测试」再拉取
    const type = testConfig.value?.type
    if (type === 'mock' || type === 'static') await loadDraftRows()
  },
  { immediate: true },
)

// 引用已保存数据源：选中即自动拉取 sample，字段选择器无需先手动测试
watch(
  () => props.draft?.dataSourceId,
  async (id) => {
    if (!props.draft || !id) {
      if (props.draft && !id) draftRows.value = []
      return
    }
    await loadDraftRows()
  },
)

function setComputedFields(fields: ComputedField[]) {
  if (props.draft) {
    props.draft.computedFields = fields
    return
  }
  if (card.value) store.updateCardField(card.value.id, 'computedFields', fields.length ? fields : undefined)
}

function getComputedFields(): ComputedField[] {
  if (props.draft) return props.draft.computedFields ?? []
  return card.value?.computedFields ?? []
}

// ==================== 数据加工（维度 / 指标 / 过滤） ====================
/** transform 草稿双向（草稿模式写 draft，否则直写 store） */
const transformModel = computed<TransformStep[]>({
  get: () => (props.draft ? (props.draft.transform ?? []) : (card.value?.transform ?? [])),
  set: (steps: TransformStep[]) => {
    if (props.draft) {
      props.draft.transform = steps
      return
    }
    if (card.value) store.updateCardField(card.value.id, 'transform', steps.length ? steps : undefined)
  },
})

// ==================== 数据流水线（与渲染侧同一条 computed 推导链） ====================
/**
 * 真实数据流（与 data/store.ts 的 loadCardData 完全一致）：
 *   原始行 → 计算列(派生) → 数据加工(filter/聚合…) → 渲染
 * ① enrichedRows：原始行 + 计算列（维度/指标/过滤的可选字段来源）
 * ② rows：enriched + transform（数据映射与内容预览消费，即卡片最终渲染的数据）
 */
const enrichedRows = computed(() => {
  if (props.draft) {
    const fromSource = mode.value === 'reference' ? (referenced.value?.computedFields ?? []) : []
    const withSource = fromSource.length ? applyComputedFields(draftRows.value, fromSource) : draftRows.value
    const cf = props.draft.computedFields
    return cf?.length ? applyComputedFields(withSource, cf) : withSource
  }
  return card.value ? dataStore.cardData.get(card.value.id) ?? [] : []
})
/** 加工前字段（含计算列）：维度 / 指标 / 过滤的可选字段 */
const sourceProfiles = computed(() => inferFieldProfiles(enrichedRows.value))
/** 原始字段：左侧测试表里插入计算列表达式 */
const rawProfiles = computed(() => inferFieldProfiles(draftRows.value))
/** 加工后行（卡片最终渲染数据，内容预览消费） */
const rows = computed(() => applyTransform(enrichedRows.value, transformModel.value))

const fields = computed(() => (rows.value[0] ? Object.keys(rows.value[0]) : []))
const registration = computed(() => (card.value ? getCardRegistration(card.value.type) : undefined))
const dataRoles = computed(() => registration.value?.dataContract?.roles.filter((role): role is DataRole & { field: string } => Boolean(role.field)) ?? [])

/** 数据内容视图：预览（默认，当前组件实时渲染）/ 表格 / JSON */
const contentView = ref<string>('preview')

const contentJson = computed(() => JSON.stringify(rows.value, null, 2))
const previewRows = computed(() => rows.value.slice(0, 50))

/** 预览态 loading / error：草稿模式取弹窗内拉取状态；非草稿跟画布数据流一致 */
const previewLoading = computed(() =>
  props.draft ? sampleLoading.value : (card.value ? dataStore.cardLoading.get(card.value.id) ?? false : false),
)
const previewError = computed(() =>
  props.draft ? null : (card.value ? dataStore.cardError.get(card.value.id) ?? null : null),
)

/** 单元格展示：对象 / 数组转 JSON，避免 [object Object] */
function formatCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function roleValue(role: DataRole & { field: string }): string | string[] {
  const value = props.draft && Object.prototype.hasOwnProperty.call(props.draft.bindings, role.field)
    ? props.draft.bindings[role.field]
    : card.value ? getByPath(card.value as unknown as Record<string, unknown>, role.field) : undefined
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  return typeof value === 'string' ? value : ''
}

function setRole(role: DataRole & { field: string }, value: string | string[]) {
  const c = card.value
  if (!c) return
  if (props.draft) {
    if (role.multiple) props.draft.bindings[role.field] = (value as string[]).length ? value : undefined
    else props.draft.bindings[role.field] = value || undefined
    return
  }
  store.updateCardField(c.id, role.field, role.multiple ? (Array.isArray(value) && value.length ? value : undefined) : (value || undefined))
}

// ==================== 绑定健康检查（基于编辑态，实时反馈） ====================

/** lodash 风格路径写值（把草稿绑定应用到卡片副本） */
function setByPathLocal(target: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)
  let cur = target
  for (let i = 0; i < keys.length - 1; i++) {
    const next = cur[keys[i]]
    if (next === null || typeof next !== 'object') cur[keys[i]] = {}
    cur = cur[keys[i]] as Record<string, unknown>
  }
  if (keys.length) cur[keys[keys.length - 1]] = value
}

/** 应用当前编辑态绑定后的卡片副本（健康检查基于编辑态而非已提交态） */
const previewCard = computed<CardSchema | null>(() => {
  const c = card.value
  if (!c) return null
  if (!props.draft) return c
  const next = plain(c) as Record<string, unknown>
  for (const [path, value] of Object.entries(props.draft.bindings)) setByPathLocal(next, path, value)
  return next as unknown as CardSchema
})

/** 绑定健康问题：必绑未绑 / 字段缺失 / 类型不匹配（info 级「暂无数据无法校验」不打扰） */
const bindingIssues = computed<BindingIssue[]>(() => {
  const c = previewCard.value
  if (!c || !registration.value) return []
  return validateDataBindings(c, registration.value, rows.value).issues.filter(i => i.level !== 'info')
})

function roleLabel(name: string): string {
  return dataRoles.value.find(r => r.name === name)?.label ?? name
}

function issueText(issue: BindingIssue): string {
  switch (issue.code) {
    case 'required-unbound': return `「${roleLabel(issue.role)}」入参未绑定字段`
    case 'field-missing': return `「${roleLabel(issue.role)}」绑定的字段 "${issue.field}" 不在当前数据中`
    case 'incompatible': return `「${roleLabel(issue.role)}」字段 "${issue.field}" 的类型与入参要求不匹配`
    default: return issue.message
  }
}

// ==================== 组件数据入参装配 ====================
/**
 * 拖放区 = 组件的数据入参（dataRoles）。
 * assignments（入参 ← 字段/聚合）+ filterConds（过滤条件）是唯一编辑态，
 * 由它们推导 transform（写 draft/store）与字段绑定（setRole）。
 */
const assignments = ref<RoleAssignment[]>([])
const filterConds = ref<FilterCondition[]>([])

/** 弹窗打开 / 切换卡片时，由当前绑定 + transform 还原装配状态 */
watch(
  () => [props.draft, card.value?.id] as const,
  () => {
    assignments.value = buildAssignments(dataRoles.value, roleValue, transformModel.value)
    filterConds.value = parseFilterConditions(transformModel.value)
  },
  { immediate: true },
)

/**
 * 装配变化 → 推导 transform 与字段绑定（单一事实源，预览与渲染同源）。
 * 注意：本 watcher 有意注册在上方「还原 watcher」之后且非 immediate ——
 * 打开弹窗时的初始还原不会触发本推导，表达式模式手写步骤（sort/limit 等）得以保留；
 * 只有用户真正编辑装配 / 过滤条件时才重新推导并覆盖 transform（表达式模式已有覆盖提示）。
 */
watch([assignments, filterConds], () => {
  transformModel.value = deriveTransform(assignments.value, dataRoles.value, filterConds.value, sourceProfiles.value)
  const map = deriveBindings(assignments.value)
  for (const role of dataRoles.value) {
    setRole(role, map[role.field] ?? (role.multiple ? [] : ''))
  }
}, { deep: true })

/** 表达式模式直接编辑的 transform（绕过推导，交给高级用户） */
function onRawTransform(steps: TransformStep[]): void {
  transformModel.value = steps
}

function downloadJson() {
  const blob = new Blob([contentJson.value], { type: 'application/json' })
  const u = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = u
  a.download = `${card.value?.type ?? 'data'}-data.json`
  a.click()
  URL.revokeObjectURL(u)
}

// ==================== 提交前校验（弹窗宿主在「完成」时调用） ====================

/** 校验当前来源配置的完整性，返回错误消息；null 表示通过。绑定类问题不阻断（由健康条提示）。 */
function validateDraft(): string | null {
  switch (mode.value) {
    case 'api':
      if (!url.value.trim()) return '请填写请求地址（URL）'
      return null
    case 'websocket':
      if (!wsUrl.value.trim()) return '请填写 WebSocket 地址（wsUrl）'
      return null
    case 'sql':
      if (!sql.value.host?.trim()) return '请填写数据库主机地址'
      if (!sql.value.query?.trim()) return '请填写 SQL 查询语句'
      return null
    case 'mock':
      if (mockModeTab.value === 'template') {
        if (!inlineDs.value.mockTemplate?.trim()) return '请填写 Mock 模板'
        return null
      }
      if (mockStaticInvalid.value) return '固定数据不是合法的 JSON，请修正后再完成'
      return null
    case 'reference':
      if (!activeDataSourceId.value) return '请选择要引用的数据源'
      if (!referenced.value) return '引用的数据源已不存在，请重新选择'
      return null
    default:
      return null
  }
}

defineExpose({ validate: validateDraft })
</script>

<template>
  <div v-if="card" class="dp">
    <!-- 左列：来源切换（固定列顶）+ 连接配置（滚动）+ 测试数据表（固定列底，含计算列） -->
    <div class="dp__left">
      <PanelTabs v-model="modeTab" :options="SOURCE_TABS" class="dp__tabs" />
      <MCard class="fill-card">
        <!-- 动态请求 -->
        <section v-if="mode === 'api'"
          class="panel-section">
          <p class="section-title">请求配置</p>
          <MFormItem label="请求地址">
            <div class="dp__url-row">
              <MSelect v-model="method" :options="METHOD_OPTIONS" class="dp__method" />
              <MInput v-model="url" placeholder="https://api.example.com/data" fluid />
            </div>
          </MFormItem>
          <div class="field-grid">
            <MFormItem label="更新间隔" help="0 = 仅初始化">
              <MInputNumber v-model="pollInterval" :min="0" fluid />
            </MFormItem>
            <MFormItem label="单位">
              <MSelect v-model="intervalUnit" :options="INTERVAL_OPTIONS" fluid />
            </MFormItem>
            <MFormItem label="超时(ms)" help="0 = 默认 15000">
              <MInputNumber v-model="timeoutMs" :min="0" fluid />
            </MFormItem>
            <MFormItem label="取数路径" help="如 data.list">
              <MInput v-model="dataPath" placeholder="留空取整个响应" fluid />
            </MFormItem>
            <MFormItem label="失败重试次数">
              <MInputNumber v-model="retryCount" :min="0" :max="5" fluid />
            </MFormItem>
            <MFormItem label="重试间隔(ms)">
              <MInputNumber v-model="retryDelay" :min="0" fluid />
            </MFormItem>
          </div>

          <MFormItem label="请求参数">
            <PanelTabs v-model="requestTab" :options="REQUEST_TABS" />
          </MFormItem>
          <KeyValueTable v-if="requestTab === 'params'" v-model="params" key-placeholder="参数名"
            value-placeholder="值（支持 {{var}}）" />
          <KeyValueTable v-else-if="requestTab === 'headers'" v-model="headers" key-placeholder="Header"
            value-placeholder="值" />
          <template v-else>
            <MFormItem label="Body 类型">
              <MSelect v-model="bodyType" :options="BODY_TYPE_OPTIONS" fluid />
            </MFormItem>
            <MFormItem v-if="bodyType === 'json' || bodyType === 'form'" label="Body 内容" help="留空则用请求参数生成">
              <MTextarea v-model="body" :rows="4" fluid />
            </MFormItem>
          </template>

          <p class="section-title">认证</p>
          <div class="field-grid">
            <MFormItem label="认证方式">
              <MSelect v-model="authType" :options="[
                { label: '无', value: 'none' },
                { label: 'Bearer Token', value: 'bearer' },
                { label: 'API Key', value: 'apikey' },
                { label: 'Basic', value: 'basic' },
              ]" fluid />
            </MFormItem>
          </div>
          <template v-if="authType === 'bearer'">
            <MFormItem label="Token">
              <MInput :model-value="inlineDs.auth?.token ?? ''"
                @update:model-value="patchAuth({ token: $event as string })" fluid />
            </MFormItem>
          </template>
          <div v-else-if="authType === 'apikey'" class="field-grid">
            <MFormItem label="Header 名">
              <MInput :model-value="inlineDs.auth?.apiKeyName ?? ''" placeholder="X-API-Key"
                @update:model-value="patchAuth({ apiKeyName: $event as string })" fluid />
            </MFormItem>
            <MFormItem label="值">
              <MInput :model-value="inlineDs.auth?.apiKeyValue ?? ''"
                @update:model-value="patchAuth({ apiKeyValue: $event as string })" fluid />
            </MFormItem>
          </div>
          <div v-else-if="authType === 'basic'" class="field-grid">
            <MFormItem label="用户名">
              <MInput :model-value="inlineDs.auth?.username ?? ''"
                @update:model-value="patchAuth({ username: $event as string })" fluid />
            </MFormItem>
            <MFormItem label="密码">
              <MInput type="password" :model-value="inlineDs.auth?.password ?? ''"
                @update:model-value="patchAuth({ password: $event as string })" fluid />
            </MFormItem>
          </div>

          <div class="dp__actions">
            <MButton type="primary" size="small" :loading="testing" @click="runTest">测试</MButton>
          </div>
        </section>

        <!-- Mock -->
        <section v-else-if="mode === 'mock'"
          class="panel-section">
          <p class="section-title">Mock 配置</p>
          <MFormItem label="数据方式">
            <MSegmented v-model="mockModeTab" :options="MOCK_MODE_OPTIONS" />
          </MFormItem>
          <MFormItem v-if="mockModeTab === 'template'" label="Mock 模板" required
            help='JSON 模板 + {{int 1 100}} 等占位符；顶层 {{repeat N}} 生成 N 行'>
            <MTextarea v-model="mockTemplate" :rows="5" fluid
              placeholder='{"name":"{{name}}","amount":"{{int 10 999}}","date":"{{date 2024-01-01 2024-12-31}}"}' />
          </MFormItem>
          <MFormItem v-else label="固定数据(JSON)" required help="直接作为结果返回，不随机生成">
            <MTextarea :model-value="staticInput" :rows="5" fluid
              @update:model-value="onStaticInput($event as string)" />
          </MFormItem>
          <p v-if="mockStaticInvalid" class="dp__error" role="alert">
            固定数据不是合法的 JSON，预览 / 测试 / 保存将沿用最近一次合法数据
          </p>
          <div class="dp__actions">
            <template v-if="mockModeTab === 'template'">
              <MButton type="default" size="small" :disabled="!inlineDs.mockTemplate" @click="formatMockTemplateText">
                格式化
              </MButton>
            </template>
            <template v-else>
              <MFileUpload choose-label="导入" accept=".json,.csv,.tsv,.txt" :max-size="5 * 1024 * 1024"
                :auto-upload="false" :show-file-list="false" @select="importMockStatic"
                @exceed-size="message.warn('文件超过 5MB 上限')" />
              <MButton type="default" size="small" @click="formatMockStatic">格式化</MButton>
            </template>
            <MButton type="primary" size="small" :loading="testing" @click="runTest">测试</MButton>
          </div>
        </section>

        <!-- WebSocket -->
        <section v-else-if="mode === 'websocket'"
          class="panel-section">
          <p class="section-title">WebSocket 配置</p>
          <MFormItem label="地址(wsUrl)">
            <MInput v-model="wsUrl" placeholder="wss://example.com/live" fluid />
          </MFormItem>
          <div class="field-grid">
            <MFormItem label="消息路径" help="如 data.list">
              <MInput v-model="wsMessagePath" placeholder="留空取整条消息" fluid />
            </MFormItem>
            <MFormItem label="聚合方式">
              <MSelect v-model="wsAggregate" :options="[
                { label: '首条', value: 'first' },
                { label: '追加', value: 'append' },
                { label: '覆盖', value: 'replace' },
              ]" fluid />
            </MFormItem>
            <MFormItem label="超时(ms)" help="收集窗口">
              <MInputNumber v-model="timeoutMs" :min="0" fluid />
            </MFormItem>
          </div>
          <div class="dp__actions">
            <MButton type="primary" size="small" :loading="testing" @click="runTest">测试</MButton>
          </div>
        </section>

        <!-- SQL -->
        <section v-else-if="mode === 'sql'"
          class="panel-section">
          <p class="section-title">SQL 配置</p>
          <p class="text-helper">经后端代理执行只读查询（仅允许 SELECT / WITH）</p>
          <div class="field-grid">
            <MFormItem label="数据库类型">
              <MSelect :model-value="sql.driver ?? 'mysql'" @update:model-value="onSqlDriverChange($event as string)"
                :options="[
                  { label: 'MySQL', value: 'mysql' },
                  { label: 'PostgreSQL', value: 'postgresql' },
                  { label: 'SQL Server', value: 'sqlserver' },
                ]" fluid />
            </MFormItem>
            <MFormItem label="主机">
              <MInput :model-value="sql.host ?? ''" placeholder="localhost"
                @update:model-value="patchSql({ host: $event })" fluid />
            </MFormItem>
            <MFormItem label="端口">
              <MInputNumber :model-value="sql.port ?? 3306" :min="1" :max="65535"
                @update:model-value="patchSql({ port: $event })" fluid />
            </MFormItem>
            <MFormItem label="数据库名">
              <MInput :model-value="sql.database ?? ''" @update:model-value="patchSql({ database: $event })" fluid />
            </MFormItem>
            <MFormItem label="用户名">
              <MInput :model-value="sql.user ?? ''" @update:model-value="patchSql({ user: $event })" fluid />
            </MFormItem>
            <MFormItem label="密码">
              <MInput type="password" :model-value="sql.password ?? ''"
                @update:model-value="patchSql({ password: $event })" fluid />
            </MFormItem>
            <MFormItem label="行数上限">
              <MInputNumber :model-value="sql.limit ?? 1000" :min="1" :max="5000"
                @update:model-value="patchSql({ limit: $event })" fluid />
            </MFormItem>
          </div>
          <MFormItem label="查询语句" help="仅允许 SELECT / WITH 只读查询">
            <MTextarea :model-value="sql.query ?? ''" :rows="5" placeholder="SELECT * FROM orders LIMIT 100"
              @update:model-value="patchSql({ query: $event })" fluid />
          </MFormItem>
          <div class="dp__actions">
            <MButton type="primary" size="small" :loading="testing" @click="runTest">测试查询</MButton>
          </div>
        </section>

        <!-- 引用数据源 -->
        <section v-else
          class="panel-section">
          <p class="section-title">引用数据源</p>
          <MFormItem label="选择数据源">
            <!-- 选项首项即「（未选择）」，无需 clearable -->
            <MSelect v-model="dataSourceId" :options="savedDataSourceOptions" fluid />
          </MFormItem>
          <div v-if="referenced" class="dp__ref">
            <MTag size="small">{{ referenced.type }}</MTag>
            <span class="dp__ref-name">{{ referenced.name }}</span>
          </div>
          <p v-else class="text-helper">未选择数据源</p>
          <div class="dp__actions">
            <MButton type="default" size="small" @click="openDataSources">去数据源管理</MButton>
            <MButton type="primary" size="small" :disabled="!referenced" :loading="testing" @click="runTest">测试
            </MButton>
          </div>
        </section>

        <!-- 测试数据常显：固定在左列下方，不随配置表单滚走 -->
        <DataResultPanel class="dp__result" :result="result"
          :loading="testing || sampleLoading" :rows="enrichedRows" :fields="getComputedFields()" :profiles="rawProfiles"
          @update:fields="setComputedFields" />
      </MCard>
    </div>

    <MDivider layout="vertical" class="dp__divider" />

    <!-- 右列：绑定数据；数据内容在组件数据入参右侧入参区下方 -->
    <div class="dp__right">
      <FieldBuilderPanel v-model:assignments="assignments" v-model:filters="filterConds" :roles="dataRoles"
        :profiles="sourceProfiles" :transform="transformModel" @update:transform="onRawTransform">
        <!-- 数据内容：放在组件数据入参右侧（维度 / 数值 / 系列等）下面 -->
        <div v-if="bindingIssues.length" class="dp__issues" role="alert">
          <p class="dp__issues-title">数据绑定有 {{ bindingIssues.length }} 个问题</p>
          <p v-for="(issue, i) in bindingIssues.slice(0, 3)" :key="i" class="dp__issues-item">· {{ issueText(issue) }}</p>
        </div>
        <p v-if="mode === 'reference' && referenced?.computedFields?.length" class="text-helper">计算列在左侧数据表中编辑</p>
        <div class="dp__content-head">
          <p class="dp__content-title">
            数据内容</p>
          <span v-if="rows.length"
            class="dp__content-count">共
            {{ rows.length }} 行<template v-if="contentView === 'table' && rows.length > 50">，预览前 50
              行</template>（已应用计算列与加工）</span>
          <PanelTabs v-model="contentView" class="dp__content-tabs"
            :options="[{ label: '预览', value: 'preview' }, { label: '表格', value: 'table' }, { label: 'JSON', value: 'json' }]" />
        </div>
        <!-- 预览：当前组件的实时渲染（编辑态绑定 previewCard + 加工后数据 rows），与画布同一渲染节点 -->
        <div v-if="contentView === 'preview'"
          class="dp__preview">
          <CardNode v-if="previewCard" :card="previewCard" :data="rows" :loading="previewLoading"
            :error="previewError" />
        </div>
        <div v-else-if="rows.length"
          class="dp__data">
          <table v-if="contentView === 'table'" class="dcontent__table">
            <thead>
              <tr>
                <th v-for="f in fields" :key="f">{{ f }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in previewRows" :key="i">
                <td v-for="f in fields" :key="f">{{ formatCell(row[f]) }}</td>
              </tr>
            </tbody>
          </table>
          <pre v-else class="dcontent__json">{{ contentJson }}</pre>
        </div>
        <p v-else class="text-helper">暂无数据 · Mock 打开即加载；请求 / WebSocket / SQL 请先在左侧点「测试」拉取</p>
        <div v-if="rows.length" class="dp__actions">
          <MButton type="default" size="small" @click="downloadJson">下载 JSON</MButton>
        </div>
      </FieldBuilderPanel>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.dp {
  height: 100%;
  min-height: 0;
  width: 100%;
  display: flex;
  overflow: hidden;

  &__left {
    height: 100%;
    min-height: 0;
    min-width: 0;
    width: 100%;
    display: flex;
    flex: 33.3333%;
    flex-direction: column;
  }

  &__tabs {
    margin-bottom: 0.5rem;
    flex-shrink: 0;
  }

  &__url-row {
    display: flex;
    gap: 0.375rem;
  }

  &__method {
    width: 110px;
    flex-shrink: 0;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  &__error {
    font-size: 12px;
    color: var(--m-color-danger);
  }

  &__ref {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  &__ref-name {
    font-size: 13px;
    color: var(--m-color-text);
  }

  &__result {
    min-height: 320px;
    min-width: 0;
    flex: 1 1 58%;
  }

  &__divider {
    height: 100%;
    flex-shrink: 0;
  }

  &__right {
    min-height: 0;
    min-width: 0;
    flex: 66.6667%;
  }

  &__issues {
    border-radius: var(--m-radius-md);
    border: 1px solid var(--m-color-warning);
    background: color-mix(in srgb, var(--m-color-warning) 8%, transparent);
    padding: 0.75rem;
    font-size: 0.75rem;
    line-height: 1rem;
    color: var(--m-color-text);
  }

  &__issues-title {
    margin-bottom: 0.25rem;
    font-weight: 600;
  }

  &__issues-item {
    margin-top: 0.25rem;
  }

  &__content-head {
    margin-top: 0.375rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    column-gap: 0.75rem;
    row-gap: 0.5rem;
  }

  &__content-title {
    flex: 1;
    border-bottom: 1px solid var(--m-color-split);
    padding-bottom: 0.375rem;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--m-color-text-muted);
  }

  &__content-count {
    order: 3;
    flex: 1 1 100%;
    font-size: 12px;
    color: var(--m-color-text-muted);
  }

  &__content-tabs {
    width: 160px;
  }

  &__preview {
    height: 280px;
    overflow: hidden;
    border-radius: var(--m-radius-md);
    border: 1px solid var(--m-color-border);
    background: var(--m-color-fill-light);
    padding: 0.75rem;
  }

  &__data {
    max-height: 240px;
    overflow: auto;
    border-radius: var(--m-radius-md);
    border: 1px solid var(--m-color-border);
    background: var(--m-color-surface);
  }
}

.fill-card {
  display: flex;
  flex-direction: column;
  height: 0;
  min-height: 0;
  flex: auto;

  :deep(.m-card__body) {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--m-space-3);
    height: 0;
    min-height: 0;
    overflow: hidden;

    > section {
      flex: 1 1 34%;
      min-height: 168px;
      overflow: auto;
    }
  }
}

.dcontent__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;

  th,
  td {
    padding: 6px 10px;
    border-bottom: 1px solid var(--m-color-split);
    text-align: left;
    white-space: nowrap;
  }

  th {
    position: sticky;
    top: 0;
    background: var(--m-color-fill-light);
    color: var(--m-color-text-muted);
    font-weight: 600;
  }
}

.dcontent__json {
  margin: 0;
  padding: 10px;
  color: var(--m-color-text);
  font-family: var(--m-font-mono, monospace);
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
