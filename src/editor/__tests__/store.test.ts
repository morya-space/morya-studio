import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { reactive } from 'vue'
import { useEditorStore } from '../store'
import { registerBuiltinCards } from '../../components/cards'
import type { PageSchema } from '../../types/schema'

function makePage(cards: PageSchema['cards'] = []): PageSchema {
  return { id: 'p1', title: 'T', layout: 'grid', grid: { cols: 12, gap: 24 }, cards }
}

describe('useEditorStore', () => {
  let store: ReturnType<typeof useEditorStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    registerBuiltinCards()
    store = useEditorStore()
    store.newPage('test')
    localStorage.clear()
  })

  it('addCard appends with default config and selects it', () => {
    const id = store.addCard('stat')
    expect(store.page.cards).toHaveLength(1)
    expect(store.page.cards[0].type).toBe('stat')
    expect(store.page.cards[0].stat).toBeDefined()
    expect(store.selectedCardId).toBe(id)
    expect(store.dirty).toBe(true)
  })

  it('addCard inserts at index', () => {
    store.addCard('stat')
    store.addCard('chart')
    store.addCard('list', 1)
    expect(store.page.cards.map(c => c.type)).toEqual(['stat', 'list', 'chart'])
    expect(store.page.cards.map(c => c.order)).toEqual([0, 1, 2])
  })

  it('removeCard deletes and clears selection', () => {
    const id = store.addCard('stat')
    store.removeCard(id)
    expect(store.page.cards).toHaveLength(0)
    expect(store.selectedCardId).toBeNull()
  })

  it('duplicateCard clones with new id after source', () => {
    const id = store.addCard('chart')
    store.duplicateCard(id)
    expect(store.page.cards).toHaveLength(2)
    expect(store.page.cards[1].id).not.toBe(id)
    expect(store.page.cards[1].type).toBe('chart')
  })

  it('moveCard reorders up/down', () => {
    const a = store.addCard('stat')
    store.addCard('chart')
    const c = store.addCard('list')
    store.moveCard(c, 'up')
    expect(store.page.cards.map(x => x.id)).toEqual([a, c, store.page.cards[2].id])
    store.moveCard(a, 'down')
    expect(store.page.cards[1].id).toBe(a)
  })

  it('moveCard at boundary is no-op for order but still dirty-safe', () => {
    const a = store.addCard('stat')
    const before = store.page.cards.map(c => c.id)
    store.moveCard(a, 'up')
    expect(store.page.cards.map(c => c.id)).toEqual(before)
  })

  it('resizeCard clamps span to grid cols', () => {
    const id = store.addCard('stat')
    store.resizeCard(id, 99)
    expect(store.page.cards[0].span).toBe(12)
    store.resizeCard(id, 0)
    expect(store.page.cards[0].span).toBe(1)
  })

  it('updateCardField sets nested path', () => {
    const id = store.addCard('chart')
    store.updateCardField(id, 'chart.chartType', 'pie')
    expect(store.page.cards[0].chart?.chartType).toBe('pie')
    store.updateCardField(id, 'chart.smooth', false)
    expect(store.page.cards[0].chart?.smooth).toBe(false)
  })

  it('updatePageField sets page title', () => {
    store.updatePageField('title', '我的看板')
    expect(store.page.title).toBe('我的看板')
  })

  it('undo/redo restores schema snapshots', () => {
    store.addCard('stat')
    store.addCard('chart')
    expect(store.page.cards).toHaveLength(2)

    store.undo()
    expect(store.page.cards).toHaveLength(1)
    expect(store.canRedo).toBe(true)

    store.redo()
    expect(store.page.cards).toHaveLength(2)
  })

  it('undo clears selection if selected card was removed', () => {
    const id = store.addCard('stat')
    store.selectCard(id)
    store.undo()
    expect(store.selectedCardId).toBeNull()
  })

  it('new edit clears redo stack', () => {
    store.addCard('stat')
    store.undo()
    expect(store.canRedo).toBe(true)
    store.addCard('chart')
    expect(store.canRedo).toBe(false)
  })

  it('save persists via service and clears dirty', async () => {
    store.updatePageField('title', '保存测试')
    await store.save()
    expect(store.dirty).toBe(false)
    // v0.3：savePage 经 http 写后端，内存缓存为权威；验证内存中页面已更新
    expect(store.page.title).toBe('保存测试')
    expect(store.page.meta?.version).toBeDefined()
  })

  it('loadPage resets history and dirty', () => {
    store.addCard('stat')
    store.loadPage(makePage([]))
    expect(store.dirty).toBe(false)
    expect(store.canUndo).toBe(false)
  })

  it('multi-select: set/toggle/clear and primary sync', () => {
    const a = store.addCard('stat')
    const b = store.addCard('chart')
    store.setSelection([a, b])
    expect(store.selectionCount).toBe(2)
    expect(store.selectedCardId).toBeNull()
    store.toggleSelection(a)
    expect(store.selectedIds).toEqual([b])
    expect(store.selectedCardId).toBe(b)
    store.clearSelection()
    expect(store.selectionCount).toBe(0)
  })

  it('moveCardsBy moves selection and clamps to canvas', () => {
    store.newPage('free')
    store.setLayout('free')
    const id = store.addCardAt('stat', 10, 10)
    store.setSelection([id])
    store.moveCardsBy([id], 40, 30)
    const card = store.page.cards[0]
    expect(card.x).toBe(50)
    expect(card.y).toBe(40)
    // clamp at left edge
    store.moveCardsBy([id], -999, -999)
    expect(store.page.cards[0].x).toBe(0)
    expect(store.page.cards[0].y).toBe(0)
  })

  it('groupSelection groups >=2 cards and tracks bbox; ungroup clears it', () => {
    store.newPage('free')
    store.setLayout('free')
    const a = store.addCardAt('stat', 0, 0)
    const b = store.addCardAt('stat', 400, 0)
    store.setSelection([a, b])
    const gid = store.groupSelection()
    expect(gid).toBeTruthy()
    expect(store.page.groups).toHaveLength(1)
    const g = store.page.groups![0]
    expect(g.x).toBe(0)
    expect(g.w).toBeGreaterThanOrEqual(400)
    expect(store.page.cards.every(c => c.groupId === gid)).toBe(true)

    // 拖动单个成员会带着整组移动
    store.moveCardsBy([a], 50, 0)
    expect(store.page.cards[1].x).toBe(450)

    store.setSelection([a])
    store.ungroupSelection()
    expect(store.page.groups).toHaveLength(0)
    expect(store.page.cards.every(c => c.groupId === undefined)).toBe(true)
  })

  it('toggleSelectionLock prevents movement', () => {
    store.newPage('free')
    store.setLayout('free')
    const id = store.addCardAt('stat', 100, 100)
    store.setSelection([id])
    store.toggleSelectionLock()
    expect(store.page.cards[0].status?.lock).toBe(true)
    store.moveCardsBy([id], 50, 50)
    expect(store.page.cards[0].x).toBe(100)
    store.toggleSelectionLock()
    expect(store.page.cards[0].status?.lock).toBe(false)
    store.moveCardsBy([id], 50, 50)
    expect(store.page.cards[0].x).toBe(150)
  })

  it('removeSelection deletes all selected and prunes empty groups', () => {
    store.newPage('free')
    store.setLayout('free')
    const a = store.addCardAt('stat', 0, 0)
    const b = store.addCardAt('stat', 300, 0)
    store.setSelection([a, b])
    store.groupSelection()
    store.setSelection([a, b])
    store.removeSelection()
    expect(store.page.cards).toHaveLength(0)
    expect(store.page.groups).toHaveLength(0)
  })

  it('new data components default to renderable Mock data', () => {
    const chartId = store.addCard('chart')
    const chartCard = store.page.cards.find(c => c.id === chartId)!
    expect(chartCard.dataSource?.type).toBe('mock')
    expect(chartCard.dataSource?.staticData?.length ?? 0).toBeGreaterThan(0)

    const statId = store.addCard('stat')
    const statCard = store.page.cards.find(c => c.id === statId)!
    expect(statCard.dataSource?.staticData?.length ?? 0).toBeGreaterThan(0)

    // 非数据型组件不注入数据源
    const textId = store.addCard('text')
    const textCard = store.page.cards.find(c => c.id === textId)!
    expect(textCard.dataSource).toBeUndefined()
  })

  it('does not crash when a panel writes reactive-derived objects into schema', () => {
    const id = store.addCard('stat')
    // 模拟数据面板：把由响应式对象展开/派生得到的对象写入 schema
    const derived = reactive({ type: 'api', params: { page: 1 }, auth: reactive({ type: 'bearer' }) })
    expect(() => store.updateCardField(id, 'dataSource', { ...derived })).not.toThrow()
    // 之后任意一次更新都会 clone 整个 page，必须仍然可用（旧实现会抛 DataCloneError 卡死）
    expect(() => store.updateCardField(id, 'title', 'T')).not.toThrow()
    expect(store.page.cards.find(c => c.id === id)?.title).toBe('T')
    // 再次切换/重写数据源也应正常
    expect(() => store.updateCardField(id, 'dataSourceId', 'ds-1')).not.toThrow()
  })

  it('bringForward / sendBackward swap adjacent order', () => {
    const a = store.addCard('stat')
    const b = store.addCard('chart')
    store.bringForward(a)
    expect(store.page.cards.map(c => c.id)).toEqual([b, a])
    store.sendBackward(a)
    expect(store.page.cards.map(c => c.id)).toEqual([a, b])
  })
})
