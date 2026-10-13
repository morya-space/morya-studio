<script setup lang="ts">
/**
 * 大纲面板
 * 树形列出页面卡片，点击选中画布对应卡片。
 */

import { computed } from 'vue'
import { useEditorStore } from '../store'
import { getCardRegistration } from '../../engine/registry'
import SvgIcon from '../../components/common/SvgIcon.vue'

const store = useEditorStore()

const cards = computed(() =>
  [...store.page.cards].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
)

function labelOf(type: string): string {
  return getCardRegistration(type as never)?.label ?? type
}

function onSelect(id: string) {
  store.selectCard(id)
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
        :class="{ active: store.selectedCardId === card.id }"
        @click="onSelect(card.id)"
      >
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
