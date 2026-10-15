import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
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
})
