<script setup lang="ts">
/**
 * 大纲 / 图层面板
 * 列出页面卡片（按 z 序），支持选中（Ctrl 多选）、拖拽排序、锁定/隐藏、分组选择与成组/解组。
 */

import { computed } from 'vue'
import { MButton, MTooltip } from 'morya-ui'
import { useEditorStore } from '../store'
import { getCardRegistration } from '../../engine/registry'
import type { CardSchema } from '../../types/schema'
import SvgIcon from '../../components/common/SvgIcon.vue'

const store = useEditorStore()

const cards = computed<CardSchema[]>(() =>
  [...store.page.cards].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
)

const groupName = (groupId?: string): string =>
  store.page.groups?.find(g => g.id === groupId)?.name ?? '分组'

function labelOf(type: string): string {
  return getCardRegistration(type as never)?.label ?? type
}

function onSelect(e: MouseEvent, id: string) {
  if (e.ctrlKey || e.metaKey) store.toggleSelection(id)
  else store.selectCard(id)
}

function isSelected(id: string): boolean {
  return store.isSelected(id)
}

function selectGroup(e: MouseEvent, groupId: string) {
  e.stopPropagation()
  store.setSelection(store.page.cards.filter(c => c.groupId === groupId).map(c => c.id))
}

function toggleLock(e: MouseEvent, card: CardSchema) {
  e.stopPropagation()
  store.setCardStatus(card.id, { lock: !card.status?.lock })
}

function toggleHide(e: MouseEvent, card: CardSchema) {
  e.stopPropagation()
  store.setCardStatus(card.id, { hide: !card.status?.hide })
}

// ==================== 成组 / 解组 ====================
const canGroup = computed(() => store.selectionCount >= 2)
const canUngroup = computed(() =>
  store.selectedIds.some(id => store.page.cards.find(c => c.id === id)?.groupId),
)

function onGroup() {
  const gid = store.groupSelection()
  if (gid) store.setSelection(store.page.cards.filter(c => c.groupId === gid).map(c => c.id))
}
function onUngroup() {
  store.ungroupSelection()
}

// ==================== 拖拽排序 ====================

let dragFromId: string | null = null
let dragOverId: string | null = null

function isDragOver(id: string): boolean {
  return dragOverId === id
}

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
    <p class="panel-tip">页面结构（点击选中，Ctrl 多选，拖拽调层序）</p>

    <div class="outline-actions">
      <MButton type="default" size="small" block :disabled="!canGroup" @click="onGroup">
        <SvgIcon name="layers" :px="12" /> 成组
      </MButton>
      <MButton type="default" size="small" block :disabled="!canUngroup" @click="onUngroup">
        解组
      </MButton>
    </div>

    <div v-if="cards.length === 0" class="panel-empty">画布还没有卡片</div>
    <ul v-else class="outline-list">
      <li
        v-for="card in cards"
        :key="card.id"
        class="outline-item"
        :class="{ active: isSelected(card.id), 'drag-over': isDragOver(card.id), muted: card.status?.hide }"
        draggable="true"
        @click="onSelect($event, card.id)"
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

        <button
          v-if="card.groupId"
          type="button"
          class="outline-group-chip"
          :title="`选择分组：${groupName(card.groupId)}`"
          @click="selectGroup($event, card.groupId)"
        >组</button>

        <span class="outline-row-actions">
          <MTooltip :content="card.status?.lock ? '解锁' : '锁定'">
            <button
              type="button"
              class="outline-icon-btn"
              :class="{ on: card.status?.lock }"
              :aria-label="card.status?.lock ? '解锁' : '锁定'"
              @click="toggleLock($event, card)"
            >
              <SvgIcon name="lock" :px="13" />
            </button>
          </MTooltip>
          <MTooltip :content="card.status?.hide ? '显示' : '隐藏'">
            <button
              type="button"
              class="outline-icon-btn"
              :class="{ on: card.status?.hide }"
              :aria-label="card.status?.hide ? '显示' : '隐藏'"
              @click="toggleHide($event, card)"
            >
              <SvgIcon :name="card.status?.hide ? 'eye-off' : 'eye'" :px="13" />
            </button>
          </MTooltip>
        </span>
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

.outline-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.outline-actions :deep(.m-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
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
  padding: 6px 8px;
  border-radius: var(--m-radius-sm);
  cursor: pointer;
  color: var(--m-color-text);
}

.outline-item.muted {
  opacity: 0.55;
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

.outline-group-chip {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border: none;
  border-radius: 999px;
  background: color-mix(in srgb, var(--m-color-primary) 14%, transparent);
  color: var(--m-color-primary);
  cursor: pointer;
}

.outline-row-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.outline-icon-btn {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: var(--m-radius-xs, 4px);
  background: transparent;
  color: var(--m-color-text-muted);
  cursor: pointer;
}

.outline-icon-btn:hover {
  background: color-mix(in srgb, var(--m-color-text-muted) 12%, transparent);
}

.outline-icon-btn.on {
  color: var(--m-color-primary);
}
</style>
