<script setup lang="ts">
/**
 * 编辑器画布
 * CSS Grid 渲染卡片（CardWrapper 包裹），支持拖放添加、点击空白取消选中。
 */

import { computed, onMounted, watch } from 'vue'
import { MScrollbar } from 'morya-ui'
import { useEditorStore } from '../store'
import { useDataStore } from '../../data/store'
import { sortCards } from '../../engine/utils'
import type { CardType } from '../../types/schema'
import CardWrapper from './CardWrapper.vue'
import SvgIcon from '../../components/common/SvgIcon.vue'

const editorStore = useEditorStore()
const dataStore = useDataStore()

const cols = computed(() => editorStore.page.grid?.cols ?? 12)
const gap = computed(() => `${editorStore.page.grid?.gap ?? 24}px`)

const sortedCards = computed(() => sortCards(editorStore.page.cards))

const gridStyle = computed(() => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${cols.value}, 1fr)`,
  gap: gap.value,
}))

// 编辑态下也加载数据，让卡片实时预览
async function loadCardData() {
  await dataStore.refreshPage(editorStore.page.cards)
}

onMounted(loadCardData)

// 卡片列表变化（增删/数据源变化）时刷新
watch(
  () => editorStore.page.cards.map(c => `${c.id}:${c.dataSourceId ?? ''}`).join(','),
  () => { void loadCardData() },
)

function onDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  const type = e.dataTransfer?.getData('card-type') as CardType | ''
  if (type) editorStore.addCard(type)
}

function onCanvasClick() {
  editorStore.selectCard(null)
}
</script>

<template>
  <MScrollbar
    class="editor-canvas"
    view-class="editor-canvas__view"
    @dragover="onDragOver"
    @drop="onDrop"
    @click="onCanvasClick"
  >
    <div class="canvas-inner">
      <!-- 空态 -->
      <div v-if="sortedCards.length === 0" class="canvas-empty">
        <SvgIcon name="layout" :px="40" />
        <p class="canvas-empty__title">从左侧拖入卡片开始搭建</p>
        <p class="canvas-empty__desc">或点击组件库中的卡片快速添加</p>
      </div>

      <!-- 卡片网格 -->
      <div v-else class="canvas-grid" :style="gridStyle">
        <CardWrapper
          v-for="(card, index) in sortedCards"
          :key="card.id"
          :schema="card"
          :index="index"
        />
      </div>
    </div>
  </MScrollbar>
</template>

<style scoped>
.editor-canvas {
  flex: 1;
  min-height: 0;
  background: var(--m-color-page-bg);
}

.editor-canvas__view {
  padding: 24px;
}

.canvas-inner {
  max-width: 1400px;
  margin: 0 auto;
  min-height: 100%;
}

.canvas-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 120px 24px;
  border: 2px dashed var(--m-color-border);
  border-radius: var(--m-radius-lg);
  color: var(--m-color-text-muted);
}

.canvas-empty__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--m-color-text);
  margin: 8px 0 0;
}

.canvas-empty__desc {
  font-size: 13px;
  margin: 0;
}

.canvas-grid {
  width: 100%;
}
</style>
