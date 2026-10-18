<script setup lang="ts">
/**
 * 编辑器画布
 * - layout 'free'：自由画布（点阵背景、缩放、网格、空态、拖入定位）
 * - layout 'grid'：兼容旧版 CSS Grid 画布
 */

import { computed, onMounted, ref, watch } from 'vue'
import { MButton, MDialog, MEmpty, MInput, MScrollbar, MTextarea, message } from 'morya-ui'
import { useEditorStore } from '../store'
import { useDataStore } from '../../data/store'
import { cardDataSourceIds, sortCards } from '../../engine/utils'
import type { CardType } from '../../types/schema'
import CardWrapper from './CardWrapper.vue'
import FreeCard from './FreeCard.vue'
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
const showGrid = computed(() => editorStore.showGrid)

const canvasWrapStyle = computed(() => ({
  width: `${editorStore.canvasSize.w * zoom.value}px`,
  height: `${editorStore.canvasSize.h * zoom.value}px`,
}))

const canvasStyle = computed(() => ({
  width: `${editorStore.canvasSize.w}px`,
  height: `${editorStore.canvasSize.h}px`,
  transform: `scale(${zoom.value})`,
  background: editorStore.page.canvas?.bgColor ?? 'var(--m-color-surface)',
  ...themeVars.value,
}))

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

// 卡片列表变化（增删/数据源变化）时刷新
watch(
  () => editorStore.page.cards.map(c => `${c.id}:${cardDataSourceIds(c).join('+')}:${c.transform?.length ?? 0}`).join(','),
  () => { void loadCardData() },
)

// ==================== 拖放添加（Free） ====================
function onDropFree(e: DragEvent) {
  e.preventDefault()
  const type = e.dataTransfer?.getData('card-type') as CardType | ''
  if (!type) return
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const x = (e.clientX - rect.left) / zoom.value - 80
  const y = (e.clientY - rect.top) / zoom.value - 40
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

function onCanvasClick() {
  editorStore.selectCard(null)
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

/** Ctrl/⌘ + 滚轮缩放画布 */
function onWheel(e: WheelEvent) {
  if (!e.ctrlKey && !e.metaKey) return
  e.preventDefault()
  editorStore.zoomBy(e.deltaY < 0 ? 0.05 : -0.05)
}
</script>

<template>
  <MScrollbar
    class="editor-canvas"
    view-class="editor-canvas__view"
    @wheel="onWheel"
  >
    <!-- ============ Free 自由画布 ============ -->
    <div
      v-if="isFree"
      class="canvas-area"
      @click.self="onCanvasClick"
    >
      <div class="canvas-wrap" :style="canvasWrapStyle">
        <div
          class="canvas"
          :style="showGrid ? { ...canvasStyle, ...gridBgStyle } : canvasStyle"
          @click="onCanvasClick"
          @dragover="onDragOver"
          @drop="onDropFree"
        >
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

          <!-- 自由卡片 -->
          <FreeCard
            v-for="card in editorStore.page.cards"
            :key="card.id"
            :schema="card"
            @edit="onCardEdit"
          />
        </div>
      </div>
    </div>

    <!-- ============ Grid 兼容画布（旧版页面） ============ -->
    <template v-else>
      <div
        class="canvas-inner"
        @dragover="onDragOver"
        @drop="onDropGrid"
        @click="onCanvasClick"
      >
        <div v-if="sortedCards.length === 0" class="canvas-empty canvas-empty--grid">
          <MEmpty
            title="从左侧拖入卡片开始搭建"
            description="或点击组件库中的卡片快速添加"
          >
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
    </template>

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
  </MScrollbar>
</template>

<style scoped>
.editor-canvas {
  flex: 1;
  min-height: 0;
  background: var(--m-color-page-bg);
}

.editor-canvas__view {
  min-height: 100%;
}

/* ============ Free 画布 ============ */
.canvas-area {
  min-height: 100%;
  display: flex;
  align-items: flex-start;
  padding: 28px 32px;
  background-image: radial-gradient(circle, color-mix(in srgb, var(--m-color-text-muted) 18%, transparent) 1px, transparent 1px);
  background-size: 20px 20px;
}

.canvas-wrap {
  position: relative;
  flex: none;
  /* 适配时居中；溢出时自动贴左（margin:auto 在负空间时为 0，避免左侧被裁掉） */
  margin: 0 auto;
}

.canvas {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: 4px;
  box-shadow: 0 10px 40px color-mix(in srgb, var(--m-color-text) 10%, transparent);
  transform-origin: top left;
  user-select: none;
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

/* ============ Grid 兼容 ============ */
.canvas-inner {
  max-width: 1400px;
  margin: 0 auto;
  min-height: 100%;
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
}
</style>
