<script setup lang="ts">
/**
 * 自由布局卡片（编辑态）
 * 绝对定位，支持拖拽移动 + 8 向缩放（吸附 10px 网格）、选中态、悬浮工具栏。
 * 内部复用真实卡片组件渲染。
 */

import { computed } from 'vue'
import type { CardSchema } from '../../types/schema'
import { useEditorStore } from '../store'
import { useDataStore } from '../../data/store'
import { getCardComponent, getCardRegistration } from '../../engine/registry'
import { cardNeedsDataSource } from '../../engine/utils'
import SvgIcon from '../../components/common/SvgIcon.vue'
import NoDataPlaceholder from './NoDataPlaceholder.vue'

const props = defineProps<{
  schema: CardSchema
}>()

const emit = defineEmits<{
  (e: 'edit', payload: { id: string; path: string }): void
}>()

const editorStore = useEditorStore()
const dataStore = useDataStore()

const isSelected = computed(() => editorStore.selectedCardId === props.schema.id)
const component = computed(() => getCardComponent(props.schema.type))
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
}))

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const

/** 双击进入内联编辑：文本/自定义卡编辑内容，其余编辑标题 */
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

let mode: DragMode = 'move'
let dir: string = ''
let sx = 0
let sy = 0
let origX = 0
let origY = 0
let origW = 0
let origH = 0
let active = false
let moved = false

function snap(v: number): number {
  const step = editorStore.snapStep
  return step > 0 ? Math.round(v / step) * step : Math.round(v)
}
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function onDragStart(e: PointerEvent, d?: string) {
  if (e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()
  editorStore.selectCard(props.schema.id)
  mode = d ? 'resize' : 'move'
  dir = d ?? ''
  sx = e.clientX
  sy = e.clientY
  origX = props.schema.x ?? 0
  origY = props.schema.y ?? 0
  origW = props.schema.w ?? 0
  origH = props.schema.h ?? 0
  active = true
  moved = false
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onEnd)
}

function onMove(e: PointerEvent) {
  if (!active) return
  const dx = e.clientX - sx
  const dy = e.clientY - sy
  if (!moved && Math.hypot(dx, dy) < 3) return
  // 手势真正开始时入撤销栈一次，避免点击选中产生空撤销步骤
  if (!moved) {
    moved = true
    editorStore.beginChange()
  }
  const card = props.schema
  const { w: cw, h: ch } = editorStore.canvasSize

  if (mode === 'move') {
    editorStore.setCardGeometry(card.id, {
      x: clamp(snap(origX + dx), 0, cw - (card.w ?? 0)),
      y: clamp(snap(origY + dy), 0, ch - (card.h ?? 0)),
    })
    return
  }

  // resize
  const MIN_W = 60
  const MIN_H = 40
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

  editorStore.setCardGeometry(card.id, {
    x: snap(nx),
    y: snap(ny),
    w: Math.max(MIN_W, Math.round(nw)),
    h: Math.max(MIN_H, Math.round(nh)),
  })
}

function onEnd() {
  active = false
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onEnd)
}

// ==================== 工具栏操作 ====================
function onDuplicate(e: MouseEvent) {
  e.stopPropagation()
  editorStore.duplicateCard(props.schema.id)
}
function onBring(pos: 'front' | 'back', e: MouseEvent) {
  e.stopPropagation()
  editorStore.bringTo(props.schema.id, pos)
}
function onRemove(e: MouseEvent) {
  e.stopPropagation()
  editorStore.removeCard(props.schema.id)
}
</script>

<template>
  <div
    class="free-card"
    :class="{ selected: isSelected }"
    :style="style"
    @pointerdown="onDragStart($event)"
    @click.stop
    @dblclick.stop="onDblClick"
  >
    <!-- 真实卡片渲染（禁用内部交互） -->
    <div class="free-card__content">
      <NoDataPlaceholder v-if="needsDataSource" />
      <component
        :is="component"
        v-else-if="component"
        :schema="schema"
        :data="data"
        :loading="loading"
        :error="error"
      />
      <div v-else class="free-card__unknown">未知类型：{{ schema.type }}</div>
    </div>

    <!-- 8 向缩放手柄 -->
    <span
      v-for="h in HANDLES"
      :key="h"
      class="handle"
      :class="`handle--${h}`"
      :data-dir="h"
      @pointerdown.stop="onDragStart($event, h)"
    />

    <!-- 悬浮工具栏 -->
    <div v-if="isSelected" class="free-card__toolbar">
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
      <button type="button" class="danger" title="删除" @pointerdown.stop @click="onRemove">
        <SvgIcon name="x" :px="13" />
      </button>
    </div>

    <!-- 尺寸角标 -->
    <span v-if="isSelected" class="free-card__badge">{{ schema.w }} × {{ schema.h }}</span>
  </div>
</template>

<style scoped>
.free-card {
  position: absolute;
  background: var(--m-color-surface);
  border: 1px solid var(--m-color-border);
  border-radius: 10px;
  cursor: move;
  user-select: none;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
}

.free-card:hover {
  border-color: color-mix(in srgb, var(--m-color-primary) 60%, transparent);
  box-shadow: var(--m-shadow-card);
}

.free-card.selected {
  border-color: var(--m-color-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--m-color-primary) 22%, transparent);
  z-index: 5;
}

.free-card__content {
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.free-card__unknown {
  height: 100%;
  display: grid;
  place-items: center;
  font-size: 12px;
  color: var(--m-color-text-muted);
}

/* 缩放手柄 */
.handle {
  position: absolute;
  width: 9px;
  height: 9px;
  background: var(--m-color-surface);
  border: 1.5px solid var(--m-color-primary);
  border-radius: 2px;
  display: none;
  z-index: 6;
}

.free-card.selected .handle {
  display: block;
}

.handle--nw { left: -5px; top: -5px; cursor: nwse-resize; }
.handle--n { left: 50%; top: -5px; margin-left: -5px; cursor: ns-resize; }
.handle--ne { right: -5px; top: -5px; cursor: nesw-resize; }
.handle--e { right: -5px; top: 50%; margin-top: -5px; cursor: ew-resize; }
.handle--se { right: -5px; bottom: -5px; cursor: nwse-resize; }
.handle--s { left: 50%; bottom: -5px; margin-left: -5px; cursor: ns-resize; }
.handle--sw { left: -5px; bottom: -5px; cursor: nesw-resize; }
.handle--w { left: -5px; top: 50%; margin-top: -5px; cursor: ew-resize; }

/* 悬浮工具栏 */
.free-card__toolbar {
  position: absolute;
  top: -34px;
  left: 0;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px 6px;
  background: var(--m-color-primary);
  border-radius: var(--m-radius-sm);
  box-shadow: var(--m-shadow-card);
  z-index: 8;
}

.free-card__toolbar button {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: var(--m-radius-xs, 4px);
  background: transparent;
  color: var(--m-color-surface);
  cursor: pointer;
}

.free-card__toolbar button:hover {
  background: color-mix(in srgb, var(--m-color-surface) 20%, transparent);
}

.free-card__toolbar button.danger:hover {
  background: var(--m-color-danger);
}

.free-card__label {
  font-size: 11px;
  font-weight: 600;
  color: var(--m-color-surface);
  padding: 0 4px;
}

.free-card__badge {
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 1px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--m-color-primary) 14%, transparent);
  color: var(--m-color-primary);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  z-index: 6;
  pointer-events: none;
}
</style>
