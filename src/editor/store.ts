/**
 * EditorStore（v0.2）
 * 低代码编辑器的核心状态：当前 PageSchema、选中、撤销/重做、脏标记。
 * 所有对 Schema 的修改走 updateSchema（不可变快照入栈，保证可撤销）。
 * 契约见 docs/DESIGN-DEV.md §8.5。
 */

import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import type { CardGroup, CardSchema, CardStatus, CardType, PageSchema } from '../types/schema'
import { SCHEMA_VERSION } from '../types/schema'
import { getCardRegistration } from '../engine/registry'
import { migrateSchema } from '../engine/migrate'
import { savePage as persistSavePage } from '../services/page'
import type { AlignGuide } from './align'
import { defaultMockTemplateFor } from '../components/cards/mocks'

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

/** 新建数据型组件时，默认绑定一份可立即渲染的 Mock 模板 */
function applyDefaultData(card: CardSchema): CardSchema {
  if (!card.dataSource && !card.dataSourceId) {
    const template = defaultMockTemplateFor(card.type)
    if (template) card.dataSource = { type: 'mock', mockTemplate: template }
  }
  return card
}

function defaultSize(type: string): { w: number; h: number } {
  return getCardRegistration(type as CardType)?.defaultSize
    ?? DEFAULT_SIZES[type]
    ?? { w: 320, h: 200 }
}

function createEmptyPage(id: string): PageSchema {
  return {
    id,
    title: '未命名看板',
    layout: 'free',
    mode: 'screen',
    grid: { cols: 12, gap: 24 },
    cards: [],
    groups: [],
    meta: { version: SCHEMA_VERSION, createdAt: new Date().toISOString() },
  }
}

function genCardId(type: string): string {
  return `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function genGroupId(): string {
  return `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export const useEditorStore = defineStore('editor', () => {
  // ---- 状态 ----
  const page = ref<PageSchema>(createEmptyPage('new'))
  const selectedCardId = ref<string | null>(null)
  /** v0.3：多选集合（含主选中项；单选时长度为 1） */
  const selection = ref<string[]>([])
  const past = ref<PageSchema[]>([])
  const future = ref<PageSchema[]>([])
  const dirty = ref(false)
  const saving = ref(false)
  /** 当前页面是否已有成功持久化的服务端记录。 */
  const persisted = ref(false)
  /** 每次 Schema 变更递增；用于判断保存期间是否又产生新草稿。 */
  const revision = ref(0)
  let savePromise: Promise<void> | null = null
  /** 画布缩放（0.4 ~ 1.5） */
  const zoom = ref(0.85)
  /** 画布平移偏移（画布视口内的左上角位置，屏幕像素） */
  const pan = ref({ x: 0, y: 0 })
  /** 画布视口尺寸（不含标尺），由 EditorCanvas 上报 */
  const viewport = ref({ w: 0, h: 0 })
  /** 画布网格显隐（默认关闭，对齐 go-view） */
  const showGrid = ref(false)
  /** 标尺显隐 */
  const showRuler = ref(true)
  /** 锁定缩放（fit 不自适应） */
  const lockScale = ref(false)
  /** 左/右面板显隐 */
  const showLeft = ref(true)
  const showRight = ref(true)
  /** 右键菜单（画布/组件），瞬时 UI 状态 */
  const contextMenu = ref<{ x: number; y: number; cardId: string | null } | null>(null)
  /** 卡片剪贴板（Ctrl+C/V 复制粘贴） */
  const clipboard = ref<CardSchema | null>(null)
  /** 拖拽时的对齐辅助线（瞬时 UI 状态，不入 Schema） */
  const guides = ref<AlignGuide[]>([])

  // ---- 计算 ----
  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)
  const selectedCard = computed<CardSchema | null>(() =>
    page.value.cards.find(c => c.id === selectedCardId.value) ?? null,
  )
  /** 多选集合（只读） */
  const selectedIds = computed(() => selection.value)
  const selectionCount = computed(() => selection.value.length)

  /** 自由画布尺寸（可被 page.canvas.width/height 覆盖） */
  const canvasSize = computed(() => ({
    w: page.value.canvas?.width ?? CANVAS_W,
    h: page.value.canvas?.height ?? CANVAS_H,
  }))

  /** 对齐吸附步长：canvas.snap（0 = 关闭），缺省 10 */
  const snapStep = computed(() => page.value.canvas?.snap ?? GRID_STEP)

  // ---- 核心：不可变更新 + 撤销栈 ----
  /**
   * 深拷贝（响应式安全）。
   * structuredClone 无法克隆 Vue Proxy（尤其嵌套 Proxy）：一旦 Schema 里混入由
   * 响应式对象展开/派生的对象，structuredClone 会抛 DataCloneError 并使编辑器卡死。
   * 故优先 structuredClone，失败时回退 JSON 深拷贝（Schema 均为可 JSON 化数据）。
   */
  function clone<T>(value: T): T {
    try {
      return structuredClone(toRaw(value))
    } catch {
      return JSON.parse(JSON.stringify(value)) as T
    }
  }

  function updateSchema(mutator: (draft: PageSchema) => void): void {
    const snapshot = clone(page.value)
    past.value.push(snapshot)
    if (past.value.length > MAX_HISTORY) past.value.shift()
    future.value = []
    // 在「无 Proxy 的纯数据副本」上修改并整体回写，避免把 Proxy 写回 Schema
    const draft = clone(snapshot)
    mutator(draft)
    page.value = draft
    markDirty()
  }

  function markDirty(): void {
    revision.value += 1
    dirty.value = true
  }

  function undo(): void {
    const prev = past.value.pop()
    if (!prev) return
    future.value.push(clone(page.value))
    page.value = prev
    markDirty()
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
    markDirty()
  }

  // ---- 选中 ----
  function selectCard(id: string | null): void {
    selectedCardId.value = id
    selection.value = id ? [id] : []
  }

  /** 直接设置多选集合（单选时同步 selectedCardId） */
  function setSelection(ids: string[]): void {
    selection.value = [...new Set(ids)]
    selectedCardId.value = selection.value.length === 1 ? selection.value[0] : null
  }

  function toggleSelection(id: string): void {
    if (selection.value.includes(id)) setSelection(selection.value.filter(x => x !== id))
    else setSelection([...selection.value, id])
  }

  function clearSelection(): void {
    setSelection([])
  }

  function isSelected(id: string): boolean {
    return selection.value.includes(id)
  }

  function setGuides(list: AlignGuide[]): void {
    guides.value = list
  }

  function setLockScale(v: boolean): void {
    lockScale.value = v
  }
  function toggleLeftPanel(): void {
    showLeft.value = !showLeft.value
  }
  function toggleRightPanel(): void {
    showRight.value = !showRight.value
  }
  function openContextMenu(payload: { x: number; y: number; cardId: string | null }): void {
    contextMenu.value = payload
  }
  function closeContextMenu(): void {
    contextMenu.value = null
  }

  /** 全选（自由布局所有可见卡片） */
  function selectAll(): void {
    setSelection(page.value.cards.map(c => c.id))
  }

  /** 清空画布 */
  function clearAll(): void {
    if (page.value.cards.length === 0) return
    updateSchema(draft => {
      draft.cards = []
      draft.groups = []
    })
    clearSelection()
  }

  // ---- 卡片操作 ----
  function addCard(type: CardType, index?: number): string {
    const reg = getCardRegistration(type)
    const defaults = reg?.defaultConfig?.() ?? {}
    const id = genCardId(type)
    const card = applyDefaultData({
      ...defaults,
      id,
      type,
      span: 6,
      order: page.value.cards.length,
    } as CardSchema)

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
    const card = applyDefaultData({
      ...defaults,
      id,
      type,
      x: clamp(Math.round(x), 0, CANVAS_W - size.w),
      y: clamp(Math.round(y), 0, CANVAS_H - size.h),
      w: size.w,
      h: size.h,
      order: page.value.cards.length,
    } as CardSchema)

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
    const { w: cw, h: ch } = canvasSize.value
    if (geom.x !== undefined) card.x = clamp(Math.round(geom.x), 0, cw - (card.w ?? 0))
    if (geom.y !== undefined) card.y = clamp(Math.round(geom.y), 0, ch - (card.h ?? 0))
    if (geom.w !== undefined) card.w = clamp(Math.round(geom.w), 24, cw - (card.x ?? 0))
    if (geom.h !== undefined) card.h = clamp(Math.round(geom.h), 1, ch - (card.y ?? 0))
    if (card.groupId) syncGroupGeometry([card.groupId])
    markDirty()
  }

  // ---- 分组 / 多选移动 / 锁定隐藏 / 层级（v0.3） ----

  function cardById(id: string): CardSchema | undefined {
    return page.value.cards.find(c => c.id === id)
  }

  /** 把选中集合扩展为「同组全部成员」，拖动分组时整组一起动 */
  function expandWithGroupMates(ids: string[]): string[] {
    const groupIds = new Set(
      ids.map(id => cardById(id)?.groupId).filter((g): g is string => Boolean(g)),
    )
    if (groupIds.size === 0) return [...ids]
    const out = new Set(ids)
    for (const c of page.value.cards) if (c.groupId && groupIds.has(c.groupId)) out.add(c.id)
    return [...out]
  }

  /** 按成员卡片重算分组包围盒 */
  function syncGroupGeometry(groupIds?: string[]): void {
    const ids = groupIds ?? [...new Set(page.value.groups?.map(g => g.id) ?? [])]
    for (const gid of ids) {
      const g = page.value.groups?.find(x => x.id === gid)
      if (!g) continue
      const members = page.value.cards.filter(c => c.groupId === gid)
      if (members.length === 0) continue
      const minX = Math.min(...members.map(c => c.x ?? 0))
      const minY = Math.min(...members.map(c => c.y ?? 0))
      const maxX = Math.max(...members.map(c => (c.x ?? 0) + (c.w ?? 0)))
      const maxY = Math.max(...members.map(c => (c.y ?? 0) + (c.h ?? 0)))
      g.x = minX; g.y = minY; g.w = maxX - minX; g.h = maxY - minY
    }
  }

  /** 把一组 id 扩展为「同组全部成员」的 id 列表（公开给拖拽逻辑） */
  function expandIds(ids: string[]): string[] {
    return expandWithGroupMates(ids)
  }

  /**
   * 从捕获的起始坐标平移一批卡片（拖拽用：以「原始位置 + 位移」计算，避免累加漂移）。
   * @param origins 卡片 id → 拖动开始时的 x/y
   */
  function moveCardsFrom(origins: Record<string, { x: number; y: number }>, dx: number, dy: number): void {
    const { w: cw, h: ch } = canvasSize.value
    const targets = Object.keys(origins)
      .map(cardById)
      .filter((c): c is CardSchema => Boolean(c))
      .filter(c => !c.status?.lock)
    if (targets.length === 0) return

    let ddx = Math.round(dx)
    let ddy = Math.round(dy)
    for (const c of targets) {
      const o = origins[c.id]
      ddx = Math.max(-o.x, Math.min(ddx, cw - o.x - (c.w ?? 0)))
      ddy = Math.max(-o.y, Math.min(ddy, ch - o.y - (c.h ?? 0)))
    }
    for (const c of targets) {
      const o = origins[c.id]
      c.x = Math.round(o.x + ddx)
      c.y = Math.round(o.y + ddy)
    }
    syncGroupGeometry(targets.map(c => c.groupId).filter((g): g is string => Boolean(g)))
    markDirty()
  }

  /** 实时移动一批卡片（含同组成员），受锁定与画布边界约束；不入撤销栈 */
  function moveCardsBy(ids: string[], dx: number, dy: number): void {
    const { w: cw, h: ch } = canvasSize.value
    const targets = expandWithGroupMates(ids)
      .map(cardById)
      .filter((c): c is CardSchema => Boolean(c))
      .filter(c => !c.status?.lock)
    if (targets.length === 0) return

    // 整组共用同一位移，取所有卡片约束下最紧的可用位移
    let ddx = Math.round(dx)
    let ddy = Math.round(dy)
    for (const c of targets) {
      ddx = Math.max(-(c.x ?? 0), Math.min(ddx, cw - (c.x ?? 0) - (c.w ?? 0)))
      ddy = Math.max(-(c.y ?? 0), Math.min(ddy, ch - (c.y ?? 0) - (c.h ?? 0)))
    }
    if (ddx === 0 && ddy === 0) return
    for (const c of targets) {
      c.x = Math.round((c.x ?? 0) + ddx)
      c.y = Math.round((c.y ?? 0) + ddy)
    }
    syncGroupGeometry(targets.map(c => c.groupId).filter((g): g is string => Boolean(g)))
    markDirty()
  }

  /** 成组：把当前多选（≥2）合并为一个分组 */
  function groupSelection(): string | null {
    const ids = selection.value.filter(id => cardById(id))
    if (ids.length < 2) return null
    const members = ids.map(id => cardById(id)!) as CardSchema[]
    const minX = Math.min(...members.map(c => c.x ?? 0))
    const minY = Math.min(...members.map(c => c.y ?? 0))
    const maxX = Math.max(...members.map(c => (c.x ?? 0) + (c.w ?? 0)))
    const maxY = Math.max(...members.map(c => (c.y ?? 0) + (c.h ?? 0)))
    const gid = genGroupId()
    updateSchema(draft => {
      if (!draft.groups) draft.groups = []
      const group: CardGroup = {
        id: gid,
        name: `分组 ${(draft.groups?.length ?? 0) + 1}`,
        x: minX, y: minY, w: maxX - minX, h: maxY - minY,
        order: draft.groups?.length ?? 0,
      }
      draft.groups.push(group)
      for (const c of draft.cards) if (ids.includes(c.id)) c.groupId = gid
    })
    return gid
  }

  /** 解组：移除选中卡片所属分组 */
  function ungroupSelection(): void {
    const gids = new Set(
      selection.value.map(id => cardById(id)?.groupId).filter((g): g is string => Boolean(g)),
    )
    if (gids.size === 0) return
    updateSchema(draft => {
      for (const c of draft.cards) if (c.groupId && gids.has(c.groupId)) delete c.groupId
      draft.groups = (draft.groups ?? []).filter(g => !gids.has(g.id))
    })
  }

  /** 批量设置状态（锁定/隐藏） */
  function setSelectionStatus(patch: Partial<CardStatus>): void {
    const ids = selection.value
    if (ids.length === 0) return
    updateSchema(draft => {
      for (const c of draft.cards) {
        if (ids.includes(c.id)) c.status = { ...(c.status ?? {}), ...patch }
      }
    })
  }

  function toggleSelectionLock(): void {
    const ids = selection.value
    if (ids.length === 0) return
    const allLocked = ids.every(id => cardById(id)?.status?.lock)
    setSelectionStatus({ lock: !allLocked })
  }

  function toggleSelectionHide(): void {
    const ids = selection.value
    if (ids.length === 0) return
    const allHidden = ids.every(id => cardById(id)?.status?.hide)
    setSelectionStatus({ hide: !allHidden })
  }

  function setCardStatus(id: string, patch: Partial<CardStatus>): void {
    updateSchema(draft => {
      const c = draft.cards.find(x => x.id === id)
      if (c) c.status = { ...(c.status ?? {}), ...patch }
    })
  }

  /** 上移一层 / 下移一层（数组相邻交换 = 预览 z 序） */
  function bringForward(id: string): void {
    updateSchema(draft => {
      const i = draft.cards.findIndex(c => c.id === id)
      if (i < 0 || i >= draft.cards.length - 1) return
      ;[draft.cards[i], draft.cards[i + 1]] = [draft.cards[i + 1], draft.cards[i]]
      draft.cards.forEach((c, idx) => { c.order = idx })
    })
  }

  function sendBackward(id: string): void {
    updateSchema(draft => {
      const i = draft.cards.findIndex(c => c.id === id)
      if (i <= 0) return
      ;[draft.cards[i], draft.cards[i - 1]] = [draft.cards[i - 1], draft.cards[i]]
      draft.cards.forEach((c, idx) => { c.order = idx })
    })
  }

  /** 删除当前多选 */
  function removeSelection(): void {
    const ids = selection.value
    if (ids.length === 0) return
    updateSchema(draft => {
      draft.cards = draft.cards.filter(c => !ids.includes(c.id))
      draft.cards.forEach((c, i) => { c.order = i })
      // 清理空分组
      const alive = new Set(draft.cards.map(c => c.groupId).filter(Boolean) as string[])
      draft.groups = (draft.groups ?? []).filter(g => alive.has(g.id))
    })
    clearSelection()
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

  function setViewport(w: number, h: number): void {
    viewport.value = { w, h }
  }
  function setPan(x: number, y: number): void {
    pan.value = { x: Math.round(x), y: Math.round(y) }
  }
  function panBy(dx: number, dy: number): void {
    setPan(pan.value.x + dx, pan.value.y + dy)
  }
  /** 以视口坐标 (ax, ay) 为锚点缩放（滚轮缩放） */
  function zoomAt(z: number, ax: number, ay: number): void {
    const old = zoom.value
    const next = clamp(z, 0.4, 1.5)
    if (next === old) return
    const k = next / old
    pan.value = {
      x: Math.round(ax - k * (ax - pan.value.x)),
      y: Math.round(ay - k * (ay - pan.value.y)),
    }
    zoom.value = next
  }
  /** 画布在视口中居中 */
  function centerCanvas(): void {
    const { w: vw, h: vh } = viewport.value
    const { w: cw, h: ch } = canvasSize.value
    setPan((vw - cw * zoom.value) / 2, (vh - ch * zoom.value) / 2)
  }
  /** 适应视口：缩放到合适比例并居中 */
  function fitCanvas(): void {
    const { w: vw, h: vh } = viewport.value
    const { w: cw, h: ch } = canvasSize.value
    if (!vw || !vh || !cw || !ch) return
    setZoom(Math.min(vw / cw, vh / ch) * 0.95)
    centerCanvas()
  }

  function removeCard(id: string): void {
    updateSchema(draft => {
      const i = draft.cards.findIndex(c => c.id === id)
      if (i >= 0) draft.cards.splice(i, 1)
      draft.cards.forEach((c, idx) => { c.order = idx })
      const alive = new Set(draft.cards.map(c => c.groupId).filter(Boolean) as string[])
      draft.groups = (draft.groups ?? []).filter(g => alive.has(g.id))
    })
    if (selectedCardId.value === id) selectedCardId.value = null
    selection.value = selection.value.filter(x => x !== id)
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
      draft.mode = layout === 'free' ? 'screen' : 'dashboard'
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
    markDirty()
  }

  /** 实时修改卡片跨度（不入撤销栈，配合 beginChange 使用） */
  function setCardSpan(id: string, span: number): void {
    const card = page.value.cards.find(c => c.id === id)
    if (!card) return
    const cols = page.value.grid?.cols ?? 12
    card.span = Math.min(cols, Math.max(1, Math.round(span)))
    markDirty()
  }

  /** 更新卡片任意字段（属性面板用，path 为 lodash 路径） */
  function updateCardField(cardId: string, path: string, value: unknown): void {
    updateSchema(draft => {
      const card = draft.cards.find(c => c.id === cardId)
      if (!card) return
      setByPath(card as unknown as Record<string, unknown>, path, value)
    })
  }

  /** 批量更新卡片字段（只记一条历史），用于「数据配置」弹窗点完成时一次性提交 */
  function updateCardFields(cardId: string, patch: Record<string, unknown>): void {
    updateSchema(draft => {
      const card = draft.cards.find(c => c.id === cardId)
      if (!card) return
      for (const [path, value] of Object.entries(patch)) {
        setByPath(card as unknown as Record<string, unknown>, path, value)
      }
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
    // 使正在进行的旧页面保存失效，避免完成后覆盖刚加载的页面。
    revision.value += 1
    page.value = migrateSchema(clone(schema))
    selectedCardId.value = null
    past.value = []
    future.value = []
    dirty.value = false
    persisted.value = true
  }

  function newPage(id: string): void {
    loadPage(createEmptyPage(id))
    persisted.value = false
  }

  async function save(): Promise<void> {
    if (savePromise) return savePromise

    const snapshot = clone(page.value)
    const revisionAtStart = revision.value
    snapshot.meta = {
      ...snapshot.meta,
      version: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
    }

    saving.value = true
    savePromise = (async () => {
      try {
        await persistSavePage(snapshot)
        // 只在保存的快照仍是当前版本时清除草稿；保存过程中继续编辑必须保留 dirty。
        if (revision.value === revisionAtStart) {
          page.value = snapshot
          dirty.value = false
          persisted.value = true
        }
      } finally {
        saving.value = false
        savePromise = null
      }
    })()
    return savePromise
  }

  return {
    // state
    page,
    selectedCardId,
    selection,
    past,
    future,
    dirty,
    saving,
    persisted,
    zoom,
    pan,
    viewport,
    showGrid,
    showRuler,
    lockScale,
    showLeft,
    showRight,
    contextMenu,
    clipboard,
    guides,
    // computed
    canUndo,
    canRedo,
    selectedCard,
    selectedIds,
    selectionCount,
    canvasSize,
    snapStep,
    // actions
    updateSchema,
    undo,
    redo,
    selectCard,
    setSelection,
    toggleSelection,
    clearSelection,
    isSelected,
    setGuides,
    setLockScale,
    toggleLeftPanel,
    toggleRightPanel,
    openContextMenu,
    closeContextMenu,
    selectAll,
    clearAll,
    expandIds,
    moveCardsFrom,
    addCard,
    addCardAt,
    removeCard,
    removeSelection,
    duplicateCard,
    moveCard,
    moveCardTo,
    resizeCard,
    beginChange,
    setCardSpan,
    setCardGeometry,
    moveCardsBy,
    groupSelection,
    ungroupSelection,
    setSelectionStatus,
    toggleSelectionLock,
    toggleSelectionHide,
    setCardStatus,
    syncGroupGeometry,
    bringForward,
    sendBackward,
    bringTo,
    setLayout,
    copyCard,
    pasteCard,
    setZoom,
    zoomBy,
    zoomAt,
    setViewport,
    setPan,
    panBy,
    centerCanvas,
    fitCanvas,
    updateCardField,
    updateCardFields,
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
