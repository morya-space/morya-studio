<script setup lang="ts">
/**
 * 卡片包装器（编辑态）
 * 复用真实卡片组件渲染，叠加：选中边框、hover 操作浮条（上移/下移/复制/删除）、跨列指示。
 */

import { computed } from 'vue'
import { MTooltip } from 'morya-ui'
import type { CardSchema } from '../../types/schema'
import { useEditorStore } from '../store'
import { useDataStore } from '../../data/store'
import { getCardRegistration } from '../../engine/registry'
import { cardNeedsDataSource } from '../../engine/utils'
import SvgIcon from '../../components/common/SvgIcon.vue'
import CardNode from '../../components/cards/CardNode.vue'
import NoDataPlaceholder from './NoDataPlaceholder.vue'

const props = defineProps<{
  schema: CardSchema
  index: number
}>()

const emit = defineEmits<{
  (e: 'edit', payload: { id: string; path: string }): void
}>()

const editorStore = useEditorStore()
const dataStore = useDataStore()

const isSelected = computed(() => editorStore.isSelected(props.schema.id))
const registration = computed(() => getCardRegistration(props.schema.type))

const data = computed(() => dataStore.cardData.get(props.schema.id) ?? [])
const loading = computed(() => dataStore.cardLoading.get(props.schema.id) ?? false)
const error = computed(() => dataStore.cardError.get(props.schema.id) ?? null)

const needsDataSource = computed(() => cardNeedsDataSource(props.schema))

const cols = computed(() => editorStore.page.grid?.cols ?? 12)
const span = computed(() => Math.min(props.schema.span ?? cols.value, cols.value))
const gridStyle = computed(() => ({ gridColumn: `span ${span}` }))

const isFirst = computed(() => props.index === 0)
const isLast = computed(() => props.index === editorStore.page.cards.length - 1)

function onSelect(e: MouseEvent) {
  e.stopPropagation()
  editorStore.selectCard(props.schema.id)
}

/** 双击进入内联编辑：文本/自定义卡编辑内容，其余编辑标题 */
function onDblClick() {
  const card = props.schema
  const path = card.type === 'text' ? 'text.content'
    : card.type === 'custom' ? 'custom.html'
    : card.title !== undefined ? 'title'
    : null
  if (path) emit('edit', { id: card.id, path })
}

function onMove(dir: 'up' | 'down', e: MouseEvent) {
  e.stopPropagation()
  editorStore.moveCard(props.schema.id, dir)
}
function onDuplicate(e: MouseEvent) {
  e.stopPropagation()
  editorStore.duplicateCard(props.schema.id)
}
function onRemove(e: MouseEvent) {
  e.stopPropagation()
  editorStore.removeCard(props.schema.id)
}

function resize(delta: number, e: MouseEvent) {
  e.stopPropagation()
  editorStore.resizeCard(props.schema.id, span.value + delta)
}

// ==================== 拖拽调整跨度（右边缘手柄） ====================

let dragging = false
let startX = 0
let startSpan = 0
let cardWidth = 0

function onResizeStart(e: PointerEvent) {
  e.preventDefault()
  e.stopPropagation()
  const el = (e.currentTarget as HTMLElement).parentElement
  if (!el) return
  dragging = true
  startX = e.clientX
  startSpan = span.value
  cardWidth = el.getBoundingClientRect().width || 1
  editorStore.beginChange()
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', onResizeEnd)
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
}

function onResizeMove(e: PointerEvent) {
  if (!dragging) return
  const cols = editorStore.page.grid?.cols ?? 12
  const dx = e.clientX - startX
  const deltaCols = (dx / cardWidth) * cols
  editorStore.setCardSpan(props.schema.id, startSpan + deltaCols)
}

function onResizeEnd() {
  dragging = false
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', onResizeEnd)
}
</script>

<template>
  <div
    class="card-wrapper"
    :class="{ selected: isSelected }"
    :style="gridStyle"
    @click="onSelect"
    @dblclick.stop="onDblClick"
  >
    <!-- 悬浮操作条 -->
    <div class="card-toolbar" :class="{ visible: isSelected }">
      <span class="card-toolbar__label">{{ registration?.label ?? schema.type }}</span>
      <div class="card-toolbar__actions">
        <MTooltip content="缩小跨度">
          <button class="tool-btn" :disabled="span <= 1" @click="resize(-1, $event)">
            <SvgIcon name="chevron-left" :px="14" />
          </button>
        </MTooltip>
        <MTooltip content="扩大跨度">
          <button class="tool-btn" :disabled="span >= cols" @click="resize(1, $event)">
            <SvgIcon name="chevron-right" :px="14" />
          </button>
        </MTooltip>
        <span class="tool-divider" />
        <MTooltip content="上移">
          <button class="tool-btn" :disabled="isFirst" @click="onMove('up', $event)">
            <SvgIcon name="chevron-up" :px="14" />
          </button>
        </MTooltip>
        <MTooltip content="下移">
          <button class="tool-btn" :disabled="isLast" @click="onMove('down', $event)">
            <SvgIcon name="chevron-down" :px="14" />
          </button>
        </MTooltip>
        <MTooltip content="复制">
          <button class="tool-btn" @click="onDuplicate">
            <SvgIcon name="plus" :px="14" />
          </button>
        </MTooltip>
        <MTooltip content="删除">
          <button class="tool-btn tool-btn--danger" @click="onRemove">
            <SvgIcon name="x" :px="14" />
          </button>
        </MTooltip>
      </div>
    </div>

    <!-- 真实卡片渲染（禁用内部交互） -->
    <div class="card-wrapper__content">
      <NoDataPlaceholder v-if="needsDataSource" />
      <CardNode
        v-else
        :card="schema"
        :data="data"
        :loading="loading"
        :error="error"
      />
    </div>

    <!-- 右边缘拖拽调整跨度 -->
    <div
      class="card-wrapper__resize"
      title="拖拽调整宽度"
      @pointerdown="onResizeStart"
      @pointermove.stop
      @click.stop
    />

    <!-- 选中指示角标 -->
    <div v-if="isSelected" class="card-wrapper__span-badge">{{ span }}/{{ cols }}</div>
  </div>
</template>

<style scoped>
.card-wrapper {
  position: relative;
  min-width: 0;
  cursor: pointer;
  border-radius: var(--m-radius-lg);
  outline: 2px solid transparent;
  outline-offset: 2px;
  transition: outline-color var(--m-motion-fast, 0.15s);
}

.card-wrapper:hover {
  outline-color: color-mix(in srgb, var(--m-color-primary) 40%, transparent);
}

.card-wrapper.selected {
  outline-color: var(--m-color-primary);
}

.card-toolbar {
  position: absolute;
  top: -34px;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 8px;
  background: var(--m-color-primary);
  border-radius: var(--m-radius-sm);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--m-motion-fast, 0.15s);
  z-index: 10;
}

.card-wrapper:hover .card-toolbar,
.card-toolbar.visible {
  opacity: 1;
  pointer-events: auto;
}

.card-toolbar__label {
  font-size: 11px;
  font-weight: 600;
  color: var(--m-color-surface);
  padding: 0 4px;
}

.card-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: var(--m-radius-xs, 4px);
  background: transparent;
  color: var(--m-color-surface);
  cursor: pointer;
}

.tool-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--m-color-surface) 20%, transparent);
}

.tool-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.tool-btn--danger:hover {
  background: var(--m-color-danger);
}

.tool-divider {
  width: 1px;
  height: 14px;
  background: color-mix(in srgb, var(--m-color-surface) 40%, transparent);
  margin: 0 2px;
}

.card-wrapper__content {
  pointer-events: none;
  height: 100%;
  overflow: hidden;
}

.card-wrapper__unknown {
  padding: 24px;
  background: var(--m-color-surface);
  border-radius: var(--m-radius-lg);
  color: var(--m-color-text-muted);
  font-size: 13px;
  text-align: center;
}

.card-wrapper__span-badge {
  position: absolute;
  bottom: 8px;
  right: 8px;
  padding: 2px 8px;
  border-radius: var(--m-radius-full, 999px);
  background: var(--m-color-primary);
  color: var(--m-color-surface);
  font-size: 11px;
  font-weight: 600;
  z-index: 5;
}

/* 拖拽调整宽度手柄：选中/悬浮时可见 */
.card-wrapper__resize {
  position: absolute;
  top: 0;
  right: -4px;
  width: 10px;
  height: 100%;
  cursor: col-resize;
  opacity: 0;
  z-index: 8;
}

.card-wrapper:hover .card-wrapper__resize,
.card-wrapper.selected .card-wrapper__resize {
  opacity: 1;
}

.card-wrapper__resize::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 3px;
  width: 3px;
  height: 40px;
  transform: translateY(-50%);
  border-radius: var(--m-radius-full, 999px);
  background: var(--m-color-primary);
}
</style>
