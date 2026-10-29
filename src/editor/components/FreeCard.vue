<script setup lang="ts">
/**
 * 自由布局卡片（编辑态，v0.3）
 * 绝对定位；支持多选联动、整组拖动、8 向缩放、对齐辅助线吸附、锁定/隐藏、右键菜单。
 */

import { computed } from 'vue'
import type { CardSchema } from '../../types/schema'
import { useEditorStore } from '../store'
import { useDataStore } from '../../data/store'
import { getCardRegistration } from '../../engine/registry'
import { cardNeedsDataSource } from '../../engine/utils'
import { computeAlignGuides, type Rect } from '../align'
import SvgIcon from '../../components/common/SvgIcon.vue'
import CardNode from '../../components/cards/CardNode.vue'
import NoDataPlaceholder from './NoDataPlaceholder.vue'

const props = defineProps<{
  schema: CardSchema
}>()

const emit = defineEmits<{
  (e: 'edit', payload: { id: string; path: string }): void
}>()

const editorStore = useEditorStore()
const dataStore = useDataStore()

const isSelected = computed(() => editorStore.isSelected(props.schema.id))
const isLocked = computed(() => Boolean(props.schema.status?.lock))
const isHidden = computed(() => Boolean(props.schema.status?.hide))
const registration = computed(() => getCardRegistration(props.schema.type))

const data = computed(() => dataStore.cardData.get(props.schema.id) ?? [])
const loading = computed(() => dataStore.cardLoading.get(props.schema.id) ?? false)
const error = computed(() => dataStore.cardError.get(props.schema.id) ?? null)
const needsDataSource = computed(() => cardNeedsDataSource(props.schema))

const style = computed(() => ({
  left: `${props.schema.x ?? 0}px`,
  top: `${props.schema.y ?? 0}px`,
  width: `${props.schema.w ?? 0}px`,
  height: `${props.schema.h ?? 0}px`,
  zIndex: (props.schema.order ?? 0) + 1,
}))

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const

function onContextMenu(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  if (!editorStore.isSelected(props.schema.id)) editorStore.selectCard(props.schema.id)
  editorStore.openContextMenu({ x: e.clientX, y: e.clientY, cardId: props.schema.id })
}

function onDblClick() {
  const card = props.schema
  const path = card.type === 'text' ? 'text.content'
    : card.type === 'custom' ? 'custom.html'
    : card.title !== undefined ? 'title'
    : null
  if (path) emit('edit', { id: card.id, path })
}

// ==================== 拖拽 / 缩放 ====================
type DragMode = 'move' | 'resize'

const ALIGN_TOLERANCE = 6

let mode: DragMode = 'move'
let dir = ''
let sx = 0
let sy = 0
let origX = 0
let origY = 0
let origW = 0
let origH = 0
let active = false
let moved = false
let origins: Record<string, { x: number; y: number }> = {}
let selIds: string[] = []
let bbox = { x: 0, y: 0, w: 0, h: 0 }

function snap(v: number): number {
  const step = editorStore.snapStep
  return step > 0 ? Math.round(v / step) * step : Math.round(v)
}

function onPointerDown(e: PointerEvent, d?: string) {
  if (e.button !== 0) return
  const card = props.schema

  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    e.stopPropagation()
    editorStore.toggleSelection(card.id)
    return
  }
  if (isLocked.value) {
    e.stopPropagation()
    editorStore.selectCard(card.id)
    return
  }

  e.preventDefault()
  e.stopPropagation()
  if (!editorStore.isSelected(card.id)) editorStore.selectCard(card.id)

  mode = d ? 'resize' : 'move'
  dir = d ?? ''
  sx = e.clientX
  sy = e.clientY
  origX = card.x ?? 0
  origY = card.y ?? 0
  origW = card.w ?? 0
  origH = card.h ?? 0
  active = true
  moved = false

  if (mode === 'move') {
    selIds = editorStore.expandIds(editorStore.selectedIds)
    origins = {}
    for (const id of selIds) {
      const c = editorStore.page.cards.find(x => x.id === id)
      if (c) origins[id] = { x: c.x ?? 0, y: c.y ?? 0 }
    }
    bbox = selectionBBox(origins)
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onEnd)
}

function selectionBBox(o: Record<string, { x: number; y: number }>): { x: number; y: number; w: number; h: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const id of Object.keys(o)) {
    const c = editorStore.page.cards.find(x => x.id === id)
    if (!c) continue
    minX = Math.min(minX, o[id].x)
    minY = Math.min(minY, o[id].y)
    maxX = Math.max(maxX, o[id].x + (c.w ?? 0))
    maxY = Math.max(maxY, o[id].y + (c.h ?? 0))
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

function alignRefs(): Rect[] {
  const sel = new Set(selIds)
  const refs: Rect[] = editorStore.page.cards
    .filter(c => !sel.has(c.id))
    .map(c => ({ id: c.id, x: c.x ?? 0, y: c.y ?? 0, w: c.w ?? 0, h: c.h ?? 0 }))
  const { w: cw, h: ch } = editorStore.canvasSize
  refs.push({ id: '__canvas__', x: 0, y: 0, w: cw, h: ch })
  return refs
}

function onMove(e: PointerEvent) {
  if (!active) return
  const rawDx = e.clientX - sx
  const rawDy = e.clientY - sy
  if (!moved && Math.hypot(rawDx, rawDy) < 3) return
  if (!moved) {
    moved = true
    editorStore.beginChange()
  }
  const z = editorStore.zoom || 1
  const dx = rawDx / z
  const dy = rawDy / z

  if (mode === 'move') {
    const sdx = snap(dx)
    const sdy = snap(dy)
    const moving: Rect = { id: '__sel__', x: bbox.x + sdx, y: bbox.y + sdy, w: bbox.w, h: bbox.h }
    const { dx: adx, dy: ady, guides } = computeAlignGuides(moving, alignRefs(), ALIGN_TOLERANCE)
    editorStore.setGuides(guides)
    editorStore.moveCardsFrom(origins, sdx + adx, sdy + ady)
    return
  }

  const MIN_W = 24
  const MIN_H = 1
  const { w: cw, h: ch } = editorStore.canvasSize
  let nx = origX
  let ny = origY
  let nw = origW
  let nh = origH

  if (dir.includes('e')) nw = origW + dx
  if (dir.includes('s')) nh = origH + dy
  if (dir.includes('w')) { nw = origW - dx; nx = origX + dx }
  if (dir.includes('n')) { nh = origH - dy; ny = origY + dy }

  if (nw < MIN_W) { if (dir.includes('w')) nx = origX + origW - MIN_W; nw = MIN_W }
  if (nh < MIN_H) { if (dir.includes('n')) ny = origY + origH - MIN_H; nh = MIN_H }

  if (nx < 0) { nw += nx; nx = 0 }
  if (ny < 0) { nh += ny; ny = 0 }
  if (nx + nw > cw) nw = cw - nx
  if (ny + nh > ch) nh = ch - ny

  editorStore.setCardGeometry(props.schema.id, {
    x: snap(nx),
    y: snap(ny),
    w: Math.max(MIN_W, Math.round(nw)),
    h: Math.max(MIN_H, Math.round(nh)),
  })
}

function onEnd() {
  active = false
  editorStore.setGuides([])
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onEnd)
}

// ==================== 工具栏操作 ====================
function stop(e: MouseEvent) {
  e.stopPropagation()
}
function onDuplicate(e: MouseEvent) {
  stop(e)
  editorStore.duplicateCard(props.schema.id)
}
function onBring(pos: 'front' | 'back', e: MouseEvent) {
  stop(e)
  editorStore.bringTo(props.schema.id, pos)
}
function onRemove(e: MouseEvent) {
  stop(e)
  editorStore.removeCard(props.schema.id)
}
function onToggleLock(e: MouseEvent) {
  stop(e)
  editorStore.selectCard(props.schema.id)
  editorStore.toggleSelectionLock()
}
function onToggleHide(e: MouseEvent) {
  stop(e)
  editorStore.setCardStatus(props.schema.id, { hide: !isHidden.value })
}
</script>

<template>
  <div
    class="free-card"
    :class="{
      selected: isSelected,
      locked: isLocked,
      hidden: isHidden,
    }"
    :style="style"
    @pointerdown="onPointerDown($event)"
    @click.stop
    @contextmenu.prevent.stop="onContextMenu"
    @dblclick.stop="onDblClick"
  >
    <div class="free-card__content">
      <NoDataPlaceholder v-if="needsDataSource" />
      <CardNode
        v-else
        :card="schema"
        :data="data"
        :loading="loading"
        :error="error"
      />
    </div>

    <!-- 8 向缩放手柄（单选且未锁定） -->
    <span
      v-for="h in HANDLES"
      v-show="isSelected && !isLocked"
      :key="h"
      class="handle"
      :class="`handle--${h}`"
      :data-dir="h"
      @pointerdown.stop="onPointerDown($event, h)"
    />

    <!-- 悬浮工具栏 -->
    <div v-if="isSelected && !isHidden" class="free-card__toolbar">
      <span class="free-card__label">{{ registration?.label ?? schema.type }}</span>
      <button type="button" title="复制" @pointerdown.stop @click="onDuplicate">
        <SvgIcon name="plus" :px="13" />
      </button>
      <button type="button" title="置顶" @pointerdown.stop @click="onBring('front', $event)">
        <SvgIcon name="arrow-up-right" :px="13" />
      </button>
      <button type="button" title="置底" @pointerdown.stop @click="onBring('back', $event)">
        <SvgIcon name="arrow-down-right" :px="13" />
      </button>
      <button type="button" :title="isLocked ? '解锁' : '锁定'" @pointerdown.stop @click="onToggleLock">
        <SvgIcon name="lock" :px="13" />
      </button>
      <button type="button" title="隐藏" @pointerdown.stop @click="onToggleHide">
        <SvgIcon name="eye-off" :px="13" />
      </button>
      <button type="button" class="danger" title="删除" @pointerdown.stop @click="onRemove">
        <SvgIcon name="x" :px="13" />
      </button>
    </div>

    <!-- 状态角标 -->
    <span v-if="isLocked" class="free-card__flag"><SvgIcon name="lock" :px="11" /></span>
    <span v-if="isSelected && !isLocked" class="free-card__badge">{{ schema.w }} x {{ schema.h }}</span>
  </div>
</template>

<style lang="scss" scoped>
.free-card {
  position: absolute;
  background: var(--m-color-surface);
  border: 1px solid var(--m-color-border);
  border-radius: 10px;
  cursor: move;
  user-select: none;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;

  &:hover {
    border-color: color-mix(in srgb, var(--m-select-color, var(--m-color-primary)) 60%, transparent);
    box-shadow: var(--m-shadow-card);
  }

  &.selected {
    border-color: var(--m-select-color, var(--m-color-primary));
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--m-select-color, var(--m-color-primary)) 22%, transparent);
  }

  &.locked {
    cursor: default;
    border-style: dashed;
  }

  &.hidden {
    opacity: 0.35;
    border-style: dashed;
    pointer-events: none;
  }

  &__content {
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: inherit;
    pointer-events: none;
  }

  /* 悬浮工具栏 */
  &__toolbar {
    position: absolute;
    top: -34px;
    left: 0;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 3px 6px;
    background: var(--m-select-color, var(--m-color-primary));
    border-radius: var(--m-radius-sm);
    box-shadow: var(--m-shadow-card);
    z-index: 8;

    button {
      display: grid;
      place-items: center;
      width: 22px;
      height: 22px;
      border: none;
      border-radius: var(--m-radius-xs, 4px);
      background: transparent;
      color: var(--m-color-surface);
      cursor: pointer;

      &:hover {
        background: color-mix(in srgb, var(--m-color-surface) 20%, transparent);
      }

      &.danger:hover {
        background: var(--m-color-danger);
      }
    }
  }

  &__label {
    font-size: 11px;
    font-weight: 600;
    color: var(--m-color-surface);
    padding: 0 4px;
  }

  &__badge {
    position: absolute;
    right: 6px;
    bottom: 6px;
    padding: 1px 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--m-select-color, var(--m-color-primary)) 14%, transparent);
    color: var(--m-select-color, var(--m-color-primary));
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    z-index: 6;
    pointer-events: none;
  }

  &__flag {
    position: absolute;
    left: 6px;
    top: 6px;
    display: inline-flex;
    padding: 2px;
    border-radius: var(--m-radius-xs, 4px);
    background: color-mix(in srgb, var(--m-color-text-muted) 20%, transparent);
    color: var(--m-color-text-muted);
    z-index: 6;
    pointer-events: none;
  }
}

/* 缩放手柄 */
.handle {
  position: absolute;
  width: 9px;
  height: 9px;
  background: var(--m-color-surface);
  border: 1.5px solid var(--m-select-color, var(--m-color-primary));
  border-radius: 2px;
  display: block;
  z-index: 6;

  &--nw { left: -5px; top: -5px; cursor: nwse-resize; }
  &--n { left: 50%; top: -5px; margin-left: -5px; cursor: ns-resize; }
  &--ne { right: -5px; top: -5px; cursor: nesw-resize; }
  &--e { right: -5px; top: 50%; margin-top: -5px; cursor: ew-resize; }
  &--se { right: -5px; bottom: -5px; cursor: nwse-resize; }
  &--s { left: 50%; bottom: -5px; margin-left: -5px; cursor: ns-resize; }
  &--sw { left: -5px; bottom: -5px; cursor: nesw-resize; }
  &--w { left: -5px; top: 50%; margin-top: -5px; cursor: ew-resize; }
}
</style>
