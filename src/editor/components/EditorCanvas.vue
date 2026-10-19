<script setup lang="ts">
/**
 * 编辑器画布（对齐 go-view 编辑区）
 * - layout 'free'：贴边标尺 + 可平移画布（空格/中键拖拽、滚轮平移、Ctrl+滚轮缩放）
 * - layout 'grid'：兼容旧版 CSS Grid 画布
 */

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { MButton, MDialog, MEmpty, MInput, MTextarea, message } from 'morya-ui'
import { useEditorStore } from '../store'
import { useDataStore } from '../../data/store'
import { sortCards } from '../../engine/utils'
import { RULER_THICK } from '../ruler'
import type { CardType } from '../../types/schema'
import type { AlignGuide } from '../align'
import CardWrapper from './CardWrapper.vue'
import FreeCard from './FreeCard.vue'
import EditorRuler from './EditorRuler.vue'
import CanvasWatermark from '../../components/common/CanvasWatermark.vue'
import SvgIcon from '../../components/common/SvgIcon.vue'

const editorStore = useEditorStore()
const dataStore = useDataStore()

const isFree = computed(() => editorStore.page.layout === 'free')

// ==================== Grid 模式（旧版） ====================
const cols = computed(() => editorStore.page.grid?.cols ?? 12)
const gap = computed(() => `${editorStore.page.grid?.gap ?? 24}px`)
const sortedCards = computed(() => sortCards(editorStore.page.cards))

const themeVars = computed<Record<string, string>>(() => {
  const t = editorStore.page.theme
  if (!t) return {}
  const out: Record<string, string> = {}
  if (t.primaryColor) out['--m-color-primary'] = t.primaryColor
  if (t.cardRadius) out['--m-radius-lg'] = `${t.cardRadius}px`
  if (t.cardShadow) out['--m-shadow-card'] = t.cardShadow
  return out
})

const gridStyle = computed(() => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${cols.value}, 1fr)`,
  gap: gap.value,
  ...themeVars.value,
}))

// ==================== Free 模式 ====================
const zoom = computed(() => editorStore.zoom)
const pan = computed(() => editorStore.pan)
const showGrid = computed(() => editorStore.showGrid)
const showRuler = computed(() => editorStore.showRuler)
const rulerOffset = computed(() => (showRuler.value ? RULER_THICK : 0))
const canvasThemeAttr = computed(() => (editorStore.page.canvas?.theme === 'dark' ? 'dark' : undefined))

const areaEl = ref<HTMLElement | null>(null)
const contentEl = ref<HTMLElement | null>(null)
const canvasEl = ref<HTMLElement | null>(null)

const contentStyle = computed(() => ({
  left: `${rulerOffset.value}px`,
  top: `${rulerOffset.value}px`,
  right: '0',
  bottom: '0',
}))

const panning = ref(false)
const spaceHeld = ref(false)

const areaClass = computed(() => ({
  'is-panning': panning.value,
  'is-pan-ready': spaceHeld.value,
}))

const canvasStyle = computed(() => {
  const c = editorStore.page.canvas
  const style: Record<string, string> = {
    left: `${pan.value.x}px`,
    top: `${pan.value.y}px`,
    width: `${editorStore.canvasSize.w}px`,
    height: `${editorStore.canvasSize.h}px`,
    transform: `scale(${zoom.value})`,
    transformOrigin: 'top left',
    background: c?.bgColor ?? 'var(--m-color-surface)',
    '--m-select-color': c?.selectColor ?? 'var(--m-color-primary)',
    ...themeVars.value,
  }
  if (c?.backgroundImage) style.backgroundImage = `url(${c.backgroundImage})`
  const cf = c?.filter
  if (cf) {
    const filters: string[] = []
    if (cf.brightness !== undefined && cf.brightness !== 1) filters.push(`brightness(${cf.brightness})`)
    if (cf.contrast !== undefined && cf.contrast !== 1) filters.push(`contrast(${cf.contrast})`)
    if (cf.saturate !== undefined && cf.saturate !== 1) filters.push(`saturate(${cf.saturate})`)
    if (cf.hueRotate) filters.push(`hue-rotate(${cf.hueRotate}deg)`)
    if (filters.length) style.filter = filters.join(' ')
    if (cf.opacity !== undefined && cf.opacity !== 1) style.opacity = String(cf.opacity)
    if (cf.blendMode && cf.blendMode !== 'normal') style.mixBlendMode = cf.blendMode
  }
  return style
})

const watermarkShow = computed(() => Boolean(editorStore.page.canvas?.watermark?.show))
const watermarkText = computed(() => editorStore.page.canvas?.watermark?.text ?? '')

/** 网格背景：颜色 / 大小来自 page.canvas 配置 */
const gridBgStyle = computed(() => {
  const c = editorStore.page.canvas
  const size = c?.gridSize ?? 10
  const color = c?.gridColor ?? 'var(--m-color-split)'
  return {
    backgroundImage: `linear-gradient(to right, ${color} 1px, transparent 1px), linear-gradient(to bottom, ${color} 1px, transparent 1px)`,
    backgroundSize: `${size}px ${size}px`,
  }
})

// 编辑态下也加载数据，让卡片实时预览
async function loadCardData() {
  await dataStore.refreshPage(editorStore.page.cards)
}

onMounted(loadCardData)

watch(
  () => editorStore.page.cards
    .map(c => `${c.id}:${c.dataSourceId ?? ''}:${c.dataSource ? JSON.stringify(c.dataSource) : ''}:${c.transform ? JSON.stringify(c.transform) : ''}`)
    .join('|'),
  () => { void loadCardData() },
)

// ==================== 视口尺寸 / 初始居中 ====================
let ro: ResizeObserver | null = null
let viewInit = false

function syncViewport() {
  const el = contentEl.value
  if (!el) return
  const w = el.clientWidth
  const h = el.clientHeight
  if (w > 0 && h > 0) editorStore.setViewport(w, h)
}

watch(
  () => [editorStore.viewport.w, editorStore.viewport.h, editorStore.canvasSize.w, editorStore.canvasSize.h] as const,
  () => {
    if (viewInit) return
    if (editorStore.viewport.w > 0 && editorStore.viewport.h > 0) {
      editorStore.centerCanvas()
      viewInit = true
    }
  },
  { immediate: true },
)

watch(contentEl, (el) => {
  ro?.disconnect()
  ro = null
  if (!el) return
  syncViewport()
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => syncViewport())
    ro.observe(el)
  }
}, { flush: 'post' })

// 切换布局到自由布局时重新居中
watch(isFree, (free) => {
  if (!free) return
  viewInit = false
  syncViewport()
  editorStore.centerCanvas()
  viewInit = true
})

onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
  window.removeEventListener('keydown', onSpaceDown)
  window.removeEventListener('keyup', onSpaceUp)
  window.removeEventListener('pointermove', onPanMove)
  window.removeEventListener('pointerup', onPanEnd)
})

// ==================== 滚轮：缩放 / 平移 ====================
function onWheel(e: WheelEvent) {
  const rect = contentEl.value?.getBoundingClientRect()
  if (e.ctrlKey || e.metaKey) {
    if (!rect) return
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    editorStore.zoomAt(editorStore.zoom * factor, e.clientX - rect.left, e.clientY - rect.top)
  } else {
    editorStore.panBy(-e.deltaX, -e.deltaY)
  }
}

// ==================== 平移（空格 / 中键） ====================
function onSpaceDown(e: KeyboardEvent) {
  if (e.code !== 'Space' || !isFree.value || e.repeat) return
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
  e.preventDefault()
  spaceHeld.value = true
}
function onSpaceUp(e: KeyboardEvent) {
  if (e.code === 'Space') spaceHeld.value = false
}

onMounted(() => {
  window.addEventListener('keydown', onSpaceDown)
  window.addEventListener('keyup', onSpaceUp)
})

let panLast = { x: 0, y: 0 }
let panActive = false

function onPanMove(e: PointerEvent) {
  if (!panActive) return
  editorStore.panBy(e.clientX - panLast.x, e.clientY - panLast.y)
  panLast = { x: e.clientX, y: e.clientY }
}
function onPanEnd() {
  panActive = false
  panning.value = false
  window.removeEventListener('pointermove', onPanMove)
  window.removeEventListener('pointerup', onPanEnd)
}

function startPan(e: PointerEvent) {
  panActive = true
  panning.value = true
  panLast = { x: e.clientX, y: e.clientY }
  window.addEventListener('pointermove', onPanMove)
  window.addEventListener('pointerup', onPanEnd)
}

// ==================== 内容区指针：平移 / 框选 ====================
function onContentPointerDown(e: PointerEvent) {
  if (spaceHeld.value || e.button === 1) {
    e.preventDefault()
    startPan(e)
    return
  }
  if (e.button !== 0) return
  startMarquee(e)
}

// ==================== 拖放添加（Free） ====================
function onDropFree(e: DragEvent) {
  e.preventDefault()
  const type = e.dataTransfer?.getData('card-type') as CardType | ''
  if (!type) return
  const rect = contentEl.value?.getBoundingClientRect()
  if (!rect) return
  const z = zoom.value || 1
  const x = (e.clientX - rect.left - pan.value.x) / z - 80
  const y = (e.clientY - rect.top - pan.value.y) / z - 40
  editorStore.addCardAt(type, Math.max(0, Math.round(x)), Math.max(0, Math.round(y)))
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

// Grid 拖放（旧版）
function onDropGrid(e: DragEvent) {
  e.preventDefault()
  const type = e.dataTransfer?.getData('card-type') as CardType | ''
  if (type) editorStore.addCard(type)
}

// ==================== 框选多选（marquee） ====================
const marquee = ref<{ x: number; y: number; w: number; h: number } | null>(null)

let mStartX = 0
let mStartY = 0
let mActive = false
let mMoved = false
let ignoreNextClick = false

const marqueeStyle = computed(() => {
  const m = marquee.value
  if (!m) return {}
  return { left: `${m.x}px`, top: `${m.y}px`, width: `${m.w}px`, height: `${m.h}px` }
})

function guideStyle(g: AlignGuide) {
  return g.axis === 'x'
    ? { left: `${g.pos}px`, top: `${g.from}px`, height: `${Math.max(0, g.to - g.from)}px` }
    : { top: `${g.pos}px`, left: `${g.from}px`, width: `${Math.max(0, g.to - g.from)}px` }
}

/** 屏幕坐标 → 画布坐标（画布已缩放/平移） */
function toCanvasCoords(clientX: number, clientY: number): { x: number; y: number } {
  const rect = canvasEl.value?.getBoundingClientRect()
  const z = zoom.value || 1
  if (!rect) return { x: 0, y: 0 }
  return { x: (clientX - rect.left) / z, y: (clientY - rect.top) / z }
}

function startMarquee(e: PointerEvent) {
  const p = toCanvasCoords(e.clientX, e.clientY)
  mStartX = p.x
  mStartY = p.y
  mActive = true
  mMoved = false
  marquee.value = { x: mStartX, y: mStartY, w: 0, h: 0 }
  window.addEventListener('pointermove', onMarqueeMove)
  window.addEventListener('pointerup', onMarqueeEnd)
}

function onMarqueeMove(e: PointerEvent) {
  if (!mActive) return
  const p = toCanvasCoords(e.clientX, e.clientY)
  const x = Math.min(mStartX, p.x)
  const y = Math.min(mStartY, p.y)
  const w = Math.abs(p.x - mStartX)
  const h = Math.abs(p.y - mStartY)
  if (!mMoved && Math.hypot(w, h) < 3) return
  mMoved = true
  marquee.value = { x, y, w, h }
  const hit = editorStore.page.cards
    .filter(c => intersects(c, x, y, w, h))
    .map(c => c.id)
  editorStore.setSelection(hit)
}

function onMarqueeEnd() {
  window.removeEventListener('pointermove', onMarqueeMove)
  window.removeEventListener('pointerup', onMarqueeEnd)
  if (mActive && mMoved) ignoreNextClick = true
  else if (mActive && !mMoved) editorStore.clearSelection()
  mActive = false
  marquee.value = null
}

function intersects(card: { x?: number; y?: number; w?: number; h?: number }, x: number, y: number, w: number, h: number): boolean {
  const cw = card.w ?? 0
  const ch = card.h ?? 0
  if (cw === 0 || ch === 0) return false
  return (card.x ?? 0) < x + w
    && (card.x ?? 0) + cw > x
    && (card.y ?? 0) < y + h
    && (card.y ?? 0) + ch > y
}

function onCanvasClick() {
  if (ignoreNextClick) {
    ignoreNextClick = false
    return
  }
  editorStore.clearSelection()
}

function onCanvasContextMenu(e: MouseEvent) {
  editorStore.openContextMenu({ x: e.clientX, y: e.clientY, cardId: null })
}

// ==================== 双击内联编辑 ====================
const inlineEdit = ref<{ cardId: string; path: string; value: string } | null>(null)

const inlineEditVisible = computed({
  get: () => !!inlineEdit.value,
  set: (v: boolean) => { if (!v) inlineEdit.value = null },
})

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)
  let cur: unknown = obj
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

function onCardEdit(payload: { id: string; path: string }) {
  const card = editorStore.page.cards.find(c => c.id === payload.id)
  if (!card) return
  const value = getByPath(card as unknown as Record<string, unknown>, payload.path)
  inlineEdit.value = { cardId: payload.id, path: payload.path, value: String(value ?? '') }
}

function onInlineSave() {
  const edit = inlineEdit.value
  if (!edit) return
  editorStore.updateCardField(edit.cardId, edit.path, edit.value)
  inlineEdit.value = null
  message.success('已更新')
}
</script>

<template>
  <div class="editor-canvas">
    <!-- ============ Free 自由画布 ============ -->
    <div
      v-if="isFree"
      class="canvas-area"
      :class="areaClass"
      @wheel.prevent="onWheel"
    >
      <EditorRuler
        v-if="showRuler"
        :pan-x="pan.x"
        :pan-y="pan.y"
        :zoom="zoom"
        :vw="editorStore.viewport.w"
        :vh="editorStore.viewport.h"
      />

      <div
        ref="contentEl"
        class="canvas-content"
        :style="contentStyle"
        @pointerdown="onContentPointerDown"
        @click="onCanvasClick"
        @contextmenu.prevent="onCanvasContextMenu"
      >
        <div
          ref="canvasEl"
          class="canvas"
          :data-theme="canvasThemeAttr"
          :style="showGrid ? { ...canvasStyle, ...gridBgStyle } : canvasStyle"
          @dragover="onDragOver"
          @drop="onDropFree"
        >
          <!-- 自由卡片 -->
          <FreeCard
            v-for="card in editorStore.page.cards"
            :key="card.id"
            :schema="card"
            @edit="onCardEdit"
          />

          <!-- 对齐辅助线 -->
          <div
            v-for="(g, i) in editorStore.guides"
            :key="`g${i}`"
            class="align-guide"
            :class="`align-guide--${g.axis}`"
            :style="guideStyle(g)"
          />

          <!-- 框选矩形 -->
          <div v-if="marquee" class="marquee" :style="marqueeStyle" />

          <!-- 水印 -->
          <CanvasWatermark v-if="watermarkShow" :text="watermarkText" />
        </div>

        <!-- 空态 -->
        <div v-if="editorStore.page.cards.length === 0" class="canvas-empty">
          <MEmpty
            title="从左侧拖入卡片开始搭建"
            description="支持自由移动与缩放，或点击组件库快速添加"
          >
            <template #icon>
              <span class="canvas-empty__icon"><SvgIcon name="layout" :px="40" /></span>
            </template>
          </MEmpty>
        </div>
      </div>
    </div>

    <!-- ============ Grid 兼容画布（旧版页面） ============ -->
    <div
      v-else
      class="canvas-grid-wrap"
      @dragover="onDragOver"
      @drop="onDropGrid"
      @click="onCanvasClick"
    >
      <div v-if="sortedCards.length === 0" class="canvas-empty canvas-empty--grid">
        <MEmpty title="从左侧拖入卡片开始搭建" description="或点击组件库中的卡片快速添加">
          <template #icon>
            <span class="canvas-empty__icon"><SvgIcon name="layout" :px="40" /></span>
          </template>
        </MEmpty>
      </div>

      <div v-else class="canvas-grid" :style="gridStyle">
        <CardWrapper
          v-for="(card, index) in sortedCards"
          :key="card.id"
          :schema="card"
          :index="index"
          @edit="onCardEdit"
        />
      </div>
    </div>

    <!-- 双击内联编辑弹窗 -->
    <MDialog
      v-model="inlineEditVisible"
      :title="inlineEdit && inlineEdit.path === 'title' ? '编辑标题' : '编辑内容'"
      width="480px"
    >
      <MInput
        v-if="inlineEdit && inlineEdit.path === 'title'"
        v-model="inlineEdit.value"
        fluid
        placeholder="标题"
      />
      <MTextarea
        v-else-if="inlineEdit"
        v-model="inlineEdit.value"
        :rows="8"
        fluid
        placeholder="内容"
      />
      <template #footer>
        <MButton type="default" @click="inlineEdit = null">取消</MButton>
        <MButton type="primary" @click="onInlineSave">保存</MButton>
      </template>
    </MDialog>
  </div>
</template>

<style scoped>
.editor-canvas {
  flex: 1;
  min-width: 0;
  min-height: 0;
  position: relative;
  background: var(--m-color-page-bg);
  overflow: hidden;
}

/* ============ Free 画布 ============ */
.canvas-area {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, color-mix(in srgb, var(--m-color-text-muted) 18%, transparent) 1px, transparent 1px);
  background-size: 20px 20px;
  overflow: hidden;
}

.canvas-area.is-pan-ready {
  cursor: grab;
}

.canvas-area.is-panning {
  cursor: grabbing;
}

.canvas-content {
  position: absolute;
  overflow: hidden;
}

.canvas {
  position: absolute;
  box-shadow: 0 10px 40px color-mix(in srgb, var(--m-color-text) 10%, transparent);
  user-select: none;
  background-repeat: no-repeat;
  background-size: cover;
}

.canvas-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.canvas-empty__icon {
  display: inline-flex;
  color: var(--m-color-text-muted);
  opacity: 0.55;
}

/* 对齐辅助线 */
.align-guide {
  position: absolute;
  z-index: 999;
  pointer-events: none;
}

.align-guide--x {
  width: 1px;
  border-left: 1px dashed var(--m-select-color, var(--m-color-primary));
}

.align-guide--y {
  height: 1px;
  border-top: 1px dashed var(--m-select-color, var(--m-color-primary));
}

/* 框选矩形 */
.marquee {
  position: absolute;
  z-index: 998;
  border: 1px dashed var(--m-select-color, var(--m-color-primary));
  background: color-mix(in srgb, var(--m-select-color, var(--m-color-primary)) 8%, transparent);
  pointer-events: none;
}

/* ============ Grid 兼容 ============ */
.canvas-grid-wrap {
  position: absolute;
  inset: 0;
  overflow: auto;
  padding: 24px 32px;
}

.canvas-empty--grid {
  position: static;
  padding: 120px 24px;
  border: 2px dashed var(--m-color-border);
  border-radius: var(--m-radius-lg);
}

.canvas-grid {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
}
</style>
