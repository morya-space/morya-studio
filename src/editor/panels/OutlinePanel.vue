<script setup lang="ts">
/**
 * 大纲面板
 * 树形列出页面卡片，点击选中画布对应卡片。
 */

import { computed } from 'vue'
import { useEditorStore } from '../store'
import { getCardRegistration } from '../../engine/registry'
import type { CardSchema } from '../../types/schema'
import SvgIcon from '../../components/common/SvgIcon.vue'

const store = useEditorStore()

const cards = computed<CardSchema[]>(() =>
  [...store.page.cards].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
)

function labelOf(type: string): string {
  return getCardRegistration(type as never)?.label ?? type
}

function onSelect(id: string) {
  store.selectCard(id)
}

function isSelected(id: string): boolean {
  return store.selectedCardId === id
}

function isDragOver(id: string): boolean {
  return dragOverId === id
}

// ==================== 拖拽排序 ====================

let dragFromId: string | null = null
let dragOverId: string | null = null

function onDragStart(e: DragEvent, id: string) {
  dragFromId = id
  dragOverId = null
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }
}

function onDragOver(e: DragEvent, id: string) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOverId = id
}

function onDrop(e: DragEvent, targetId: string) {
  e.preventDefault()
  e.stopPropagation()
  const fromId = dragFromId ?? e.dataTransfer?.getData('text/plain')
  dragOverId = null
  dragFromId = null
  if (!fromId || fromId === targetId) return
  const targetIndex = cards.value.findIndex(c => c.id === targetId)
  if (targetIndex >= 0) store.moveCardTo(fromId, targetIndex)
}

function onDragEnd() {
  dragFromId = null
  dragOverId = null
}
</script>

<template>
  <div class="outline-panel">
    <p class="panel-tip">页面结构（点击选中）</p>
    <div v-if="cards.length === 0" class="panel-empty">画布还没有卡片</div>
    <ul v-else class="outline-list">
      <li
        v-for="card in cards"
        :key="card.id"
        class="outline-item"
        :class="{ active: isSelected(card.id), 'drag-over': isDragOver(card.id) }"
        draggable="true"
        @click="onSelect(card.id)"
        @dragstart="onDragStart($event, card.id)"
        @dragover="onDragOver($event, card.id)"
        @drop="onDrop($event, card.id)"
        @dragend="onDragEnd"
      >
        <span class="outline-grip">
          <SvgIcon name="more" :px="12" />
        </span>
        <SvgIcon :name="getCardRegistration(card.type)?.icon ?? 'grid'" :px="14" />
        <span class="outline-label">{{ card.title ?? labelOf(card.type) }}</span>
        <span class="outline-type">{{ labelOf(card.type) }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.outline-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.panel-tip {
  font-size: 12px;
  color: var(--m-color-text-muted);
  margin: 0;
}

.panel-empty {
  font-size: 12px;
  color: var(--m-color-text-muted);
  text-align: center;
  padding: 24px 0;
}

.outline-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.outline-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--m-radius-sm);
  cursor: pointer;
  color: var(--m-color-text);
}

.outline-item:hover {
  background: var(--m-color-bg-hover, color-mix(in srgb, var(--m-color-primary) 6%, transparent));
}

.outline-item.active {
  background: color-mix(in srgb, var(--m-color-primary) 10%, transparent);
  color: var(--m-color-primary);
}

.outline-item.drag-over {
  outline: 2px dashed var(--m-color-primary);
  outline-offset: -2px;
}

.outline-grip {
  display: inline-flex;
  color: var(--m-color-text-muted);
  opacity: 0;
  cursor: grab;
}

.outline-item:hover .outline-grip {
  opacity: 1;
}

.outline-label {
  font-size: 13px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.outline-type {
  font-size: 11px;
  color: var(--m-color-text-muted);
  flex-shrink: 0;
}
</style>
