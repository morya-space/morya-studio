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
import { savePage as persistSavePage } from '../services/page'

const MAX_HISTORY = 50

function createEmptyPage(id: string): PageSchema {
  return {
    id,
    title: '未命名看板',
    layout: 'grid',
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

  // ---- 计算 ----
  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)
  const selectedCard = computed<CardSchema | null>(() =>
    page.value.cards.find(c => c.id === selectedCardId.value) ?? null,
  )

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
    const srcIndex = page.value.cards.findIndex(c => c.id === id)
    updateSchema(draft => {
      draft.cards.splice(srcIndex + 1, 0, copy)
      draft.cards.forEach((c, i) => { c.order = i })
    })
    selectedCardId.value = copy.id
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

  function resizeCard(id: string, span: number): void {
    updateSchema(draft => {
      const card = draft.cards.find(c => c.id === id)
      if (!card) return
      const cols = draft.grid?.cols ?? 12
      card.span = Math.min(cols, Math.max(1, span))
    })
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
    page.value = clone(schema)
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
    // computed
    canUndo,
    canRedo,
    selectedCard,
    // actions
    updateSchema,
    undo,
    redo,
    selectCard,
    addCard,
    removeCard,
    duplicateCard,
    moveCard,
    resizeCard,
    updateCardField,
    updatePageField,
    loadPage,
    newPage,
    save,
  }
})

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
