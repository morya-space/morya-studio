/**
 * EditorStore（v0.2）
 * 低代码编辑器的核心状态：当前 PageSchema、选中、撤销/重做、脏标记。
 * 所有对 Schema 的修改走 updateSchema（不可变快照入栈，保证可撤销）。
 * 契约见 docs/DESIGN-DEV.md §8.5。
 */

import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import type { CardSchema, CardType, PageSchema } from '../types/schema'
import { SCHEMA_VERSION } from '../types/schema'
import { getCardRegistration } from '../engine/registry'
import { migrateSchema } from '../engine/migrate'
import { savePage as persistSavePage } from '../services/page'

const MAX_HISTORY = 50

/** 自由布局画布尺寸（px） */
export const CANVAS_W = 1200
export const CANVAS_H = 760
export const GRID_STEP = 10

/** 各卡片类型的默认自由布局尺寸（px） */
const DEFAULT_SIZES: Record<string, { w: number; h: number }> = {
  stat: { w: 250, h: 130 },
  chart: { w: 420, h: 250 },
  table: { w: 460, h: 250 },
  list: { w: 380, h: 250 },
  banner: { w: 600, h: 120 },
  text: { w: 320, h: 66 },
  custom: { w: 320, h: 120 },
}

function defaultSize(type: string): { w: number; h: number } {
  return DEFAULT_SIZES[type] ?? { w: 320, h: 200 }
}

function createEmptyPage(id: string): PageSchema {
  return {
    id,
    title: '未命名看板',
    layout: 'free',
    grid: { cols: 12, gap: 24 },
    cards: [],
    meta: { version: SCHEMA_VERSION, createdAt: new Date().toISOString() },
  }
}

function genCardId(type: string): string {
  return `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export const useEditorStore = defineStore('editor', () => {
  // ---- 状态 ----
  const page = ref<PageSchema>(createEmptyPage('new'))
  const selectedCardId = ref<string | null>(null)
  const past = ref<PageSchema[]>([])
  const future = ref<PageSchema[]>([])
  const dirty = ref(false)
  const saving = ref(false)
  /** 画布缩放（0.4 ~ 1.5） */
  const zoom = ref(0.85)
  /** 画布网格显隐 */
  const showGrid = ref(true)
  /** 卡片剪贴板（Ctrl+C/V 复制粘贴） */
  const clipboard = ref<CardSchema | null>(null)

  // ---- 计算 ----
  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)
  const selectedCard = computed<CardSchema | null>(() =>
    page.value.cards.find(c => c.id === selectedCardId.value) ?? null,
  )

  /** 自由画布尺寸（可被 page.canvas.width/height 覆盖） */
  const canvasSize = computed(() => ({
    w: page.value.canvas?.width ?? CANVAS_W,
    h: page.value.canvas?.height ?? CANVAS_H,
  }))

  /** 对齐吸附步长：canvas.snap（0 = 关闭），缺省 10 */
  const snapStep = computed(() => page.value.canvas?.snap ?? GRID_STEP)

  // ---- 核心：不可变更新 + 撤销栈 ----
  /** 深拷贝响应式对象（structuredClone 无法克隆 Vue Proxy） */
  function clone<T>(value: T): T {
    return structuredClone(toRaw(value))
  }

  function updateSchema(mutator: (draft: PageSchema) => void): void {
    const snapshot = clone(page.value)
    past.value.push(snapshot)
    if (past.value.length > MAX_HISTORY) past.value.shift()
    future.value = []
    mutator(page.value)
    dirty.value = true
  }

  function undo(): void {
    const prev = past.value.pop()
    if (!prev) return
    future.value.push(clone(page.value))
    page.value = prev
    dirty.value = true
    // 选中项可能已被撤销掉
    if (selectedCardId.value && !page.value.cards.some(c => c.id === selectedCardId.value)) {
      selectedCardId.value = null
    }
  }

  function redo(): void {
    const next = future.value.pop()
    if (!next) return
    past.value.push(clone(page.value))
    page.value = next
    dirty.value = true
  }

  // ---- 选中 ----
  function selectCard(id: string | null): void {
    selectedCardId.value = id
  }

  // ---- 卡片操作 ----
  function addCard(type: CardType, index?: number): string {
    const reg = getCardRegistration(type)
    const defaults = reg?.defaultConfig?.() ?? {}
    const id = genCardId(type)
    const card: CardSchema = {
      ...defaults,
      id,
      type,
      span: 6,
      order: page.value.cards.length,
    } as CardSchema

    updateSchema(draft => {
      if (index === undefined || index < 0 || index >= draft.cards.length) {
        draft.cards.push(card)
      } else {
        draft.cards.splice(index, 0, card)
      }
      // 重排 order
      draft.cards.forEach((c, i) => { c.order = i })
    })
    selectedCardId.value = id
    return id
  }

  /** 自由布局：在指定位置添加卡片（组件库拖入画布） */
  function addCardAt(type: CardType, x: number, y: number): string {
    const reg = getCardRegistration(type)
    const defaults = reg?.defaultConfig?.() ?? {}
    const size = defaultSize(type)
    const id = genCardId(type)
    const card: CardSchema = {
      ...defaults,
      id,
      type,
      x: clamp(Math.round(x), 0, CANVAS_W - size.w),
      y: clamp(Math.round(y), 0, CANVAS_H - size.h),
      w: size.w,
      h: size.h,
      order: page.value.cards.length,
    } as CardSchema

    updateSchema(draft => {
      draft.cards.push(card)
      draft.cards.forEach((c, i) => { c.order = i })
    })
    selectedCardId.value = id
    return id
  }

  /** 实时更新卡片几何（自由布局拖拽/缩放，配合 beginChange 使用） */
  function setCardGeometry(id: string, geom: Partial<{ x: number; y: number; w: number; h: number }>): void {
    const card = page.value.cards.find(c => c.id === id)
    if (!card) return
    if (geom.x !== undefined) card.x = clamp(Math.round(geom.x), 0, CANVAS_W - (card.w ?? 0))
    if (geom.y !== undefined) card.y = clamp(Math.round(geom.y), 0, CANVAS_H - (card.h ?? 0))
    if (geom.w !== undefined) card.w = Math.max(60, Math.round(geom.w))
    if (geom.h !== undefined) card.h = Math.max(40, Math.round(geom.h))
    dirty.value = true
  }

  /** 置顶 / 置底（自由布局 z 序 = 数组顺序） */
  function bringTo(id: string, pos: 'front' | 'back'): void {
    updateSchema(draft => {
      const i = draft.cards.findIndex(c => c.id === id)
      if (i < 0) return
      const [card] = draft.cards.splice(i, 1)
      if (pos === 'front') draft.cards.push(card)
      else draft.cards.unshift(card)
      draft.cards.forEach((c, idx) => { c.order = idx })
    })
  }

  /** 缩放画布 */
  function setZoom(v: number): void {
    zoom.value = clamp(v, 0.4, 1.5)
  }
  function zoomBy(d: number): void {
    setZoom(zoom.value + d)
  }

  function removeCard(id: string): void {
    updateSchema(draft => {
      const i = draft.cards.findIndex(c => c.id === id)
      if (i >= 0) draft.cards.splice(i, 1)
      draft.cards.forEach((c, idx) => { c.order = idx })
    })
    if (selectedCardId.value === id) selectedCardId.value = null
  }

  function duplicateCard(id: string): void {
    const src = page.value.cards.find(c => c.id === id)
    if (!src) return
    const copy: CardSchema = clone(src)
    copy.id = genCardId(src.type)
    // 自由布局：副本偏移 24px，避免与原件重叠
    if (page.value.layout === 'free') {
      copy.x = clamp((copy.x ?? 0) + 24, 0, CANVAS_W - (copy.w ?? 0))
      copy.y = clamp((copy.y ?? 0) + 24, 0, CANVAS_H - (copy.h ?? 0))
    }
    const srcIndex = page.value.cards.findIndex(c => c.id === id)
    updateSchema(draft => {
      draft.cards.splice(srcIndex + 1, 0, copy)
      draft.cards.forEach((c, i) => { c.order = i })
    })
    selectedCardId.value = copy.id
  }

  /** 页面布局切换（自由 ⇄ 网格），自动补齐对应几何/跨列 */
  function setLayout(layout: 'free' | 'grid'): void {
    updateSchema(draft => {
      draft.layout = layout
      const cols = draft.grid?.cols ?? 12
      const colWidth = CANVAS_W / cols
      draft.cards.forEach((card, i) => {
        if (layout === 'free') {
          const size = defaultSize(card.type)
          if (card.x === undefined) card.x = 40 + (i % 4) * 40
          if (card.y === undefined) card.y = 40 + (i % 4) * 30
          if (card.w === undefined) card.w = size.w
          if (card.h === undefined) card.h = size.h
        } else {
          if (card.span === undefined) {
            card.span = clamp(Math.round((card.w ?? 320) / colWidth), 1, cols)
          }
        }
      })
    })
  }

  /** 复制选中卡片到剪贴板（Ctrl+C） */
  function copyCard(id: string): void {
    const src = page.value.cards.find(c => c.id === id)
    if (!src) return
    clipboard.value = clone(src)
  }

  /** 粘贴剪贴板卡片（Ctrl+V），自由布局 +24 偏移避免重叠 */
  function pasteCard(): string | null {
    const src = clipboard.value
    if (!src) return null
    const copy: CardSchema = clone(src)
    copy.id = genCardId(src.type)
    if (page.value.layout === 'free') {
      copy.x = clamp((copy.x ?? 0) + 24, 0, CANVAS_W - (copy.w ?? 0))
      copy.y = clamp((copy.y ?? 0) + 24, 0, CANVAS_H - (copy.h ?? 0))
    }
    updateSchema(draft => {
      draft.cards.push(copy)
      draft.cards.forEach((c, i) => { c.order = i })
    })
    selectedCardId.value = copy.id
    return copy.id
  }

  function moveCard(id: string, direction: 'up' | 'down'): void {
    updateSchema(draft => {
      const i = draft.cards.findIndex(c => c.id === id)
      if (i < 0) return
      const j = direction === 'up' ? i - 1 : i + 1
      if (j < 0 || j >= draft.cards.length) return
      const [card] = draft.cards.splice(i, 1)
      draft.cards.splice(j, 0, card)
      draft.cards.forEach((c, idx) => { c.order = idx })
    })
  }

  /** 把卡片移到指定下标（大纲拖拽排序用） */
  function moveCardTo(fromId: string, toIndex: number): void {
    updateSchema(draft => {
      const from = draft.cards.findIndex(c => c.id === fromId)
      if (from < 0) return
      const [card] = draft.cards.splice(from, 1)
      let target = toIndex
      if (from < target) target -= 1
      target = Math.max(0, Math.min(draft.cards.length, target))
      draft.cards.splice(target, 0, card)
      draft.cards.forEach((c, idx) => { c.order = idx })
    })
  }

  function resizeCard(id: string, span: number): void {
    updateSchema(draft => {
      const card = draft.cards.find(c => c.id === id)
      if (!card) return
      const cols = draft.grid?.cols ?? 12
      card.span = Math.min(cols, Math.max(1, span))
    })
  }

  /** 拖拽/手势开始：把当前状态入撤销栈（后续可整体撤销一次手势） */
  function beginChange(): void {
    past.value.push(clone(page.value))
    if (past.value.length > MAX_HISTORY) past.value.shift()
    future.value = []
    dirty.value = true
  }

  /** 实时修改卡片跨度（不入撤销栈，配合 beginChange 使用） */
  function setCardSpan(id: string, span: number): void {
    const card = page.value.cards.find(c => c.id === id)
    if (!card) return
    const cols = page.value.grid?.cols ?? 12
    card.span = Math.min(cols, Math.max(1, Math.round(span)))
    dirty.value = true
  }

  /** 更新卡片任意字段（属性面板用，path 为 lodash 路径） */
  function updateCardField(cardId: string, path: string, value: unknown): void {
    updateSchema(draft => {
      const card = draft.cards.find(c => c.id === cardId)
      if (!card) return
      setByPath(card as unknown as Record<string, unknown>, path, value)
    })
  }

  /** 更新页面级字段 */
  function updatePageField(path: string, value: unknown): void {
    updateSchema(draft => {
      setByPath(draft as unknown as Record<string, unknown>, path, value)
    })
  }

  // ---- 加载 / 保存 ----
  function loadPage(schema: PageSchema): void {
    page.value = migrateSchema(clone(schema))
    selectedCardId.value = null
    past.value = []
    future.value = []
    dirty.value = false
  }

  function newPage(id: string): void {
    loadPage(createEmptyPage(id))
  }

  async function save(): Promise<void> {
    saving.value = true
    try {
      page.value.meta = {
        ...page.value.meta,
        version: SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
      }
      persistSavePage(page.value)
      dirty.value = false
    } finally {
      saving.value = false
    }
  }

  return {
    // state
    page,
    selectedCardId,
    past,
    future,
    dirty,
    saving,
    zoom,
    showGrid,
    clipboard,
    // computed
    canUndo,
    canRedo,
    selectedCard,
    canvasSize,
    snapStep,
    // actions
    updateSchema,
    undo,
    redo,
    selectCard,
    addCard,
    addCardAt,
    removeCard,
    duplicateCard,
    moveCard,
    moveCardTo,
    resizeCard,
    beginChange,
    setCardSpan,
    setCardGeometry,
    bringTo,
    setLayout,
    copyCard,
    pasteCard,
    setZoom,
    zoomBy,
    updateCardField,
    updatePageField,
    loadPage,
    newPage,
    save,
  }
})

// ---- 工具 ----
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

// ---- 工具：lodash 风格路径写值 ----
function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)
  let cur: Record<string, unknown> = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    const next = cur[key]
    if (next === null || typeof next !== 'object') {
      cur[key] = {}
    }
    cur = cur[key] as Record<string, unknown>
  }
  cur[parts[parts.length - 1]] = value
}
