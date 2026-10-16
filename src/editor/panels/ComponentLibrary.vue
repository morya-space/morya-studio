<script setup lang="ts">
/**
 * 组件库面板
 * 按 图表/基础 分组，支持拖拽到画布 / 点击添加（自由布局落到默认位置）。
 */

import { computed } from 'vue'
import { getAllRegistrations } from '../../engine/registry'
import type { CardType } from '../../types/schema'
import { useEditorStore } from '../store'
import SvgIcon from '../../components/common/SvgIcon.vue'

const store = useEditorStore()
const registrations = getAllRegistrations()

const GROUPS: { key: 'chart' | 'basic'; label: string }[] = [
  { key: 'chart', label: '图表' },
  { key: 'basic', label: '基础' },
]

const grouped = computed(() =>
  GROUPS.map(g => ({
    ...g,
    items: registrations.filter(r => (r.category ?? 'basic') === g.key),
  })),
)

function onDragStart(event: DragEvent, type: CardType) {
  if (!event.dataTransfer) return
  event.dataTransfer.setData('card-type', type)
  event.dataTransfer.effectAllowed = 'copy'
}

function onClickAdd(type: CardType) {
  if (store.page.layout === 'free') {
    // 自由布局：级联偏移放置，避免重叠
    const n = store.page.cards.length
    const x = 40 + (n % 4) * 40
    const y = 40 + (n % 4) * 30
    store.addCardAt(type, x, y)
  } else {
    store.addCard(type)
  }
}
</script>

<template>
  <div class="component-library">
    <div v-for="group in grouped" :key="group.key" class="comp-group">
      <p class="comp-group__title">{{ group.label }}</p>
      <div v-if="group.items.length" class="comp-grid">
        <button
          v-for="reg in group.items"
          :key="reg.type"
          class="comp-item"
          draggable="true"
          @dragstart="onDragStart($event, reg.type)"
          @click="onClickAdd(reg.type)"
        >
          <span class="comp-item__icon">
            <SvgIcon :name="reg.icon ?? 'grid'" :px="20" />
          </span>
          <span class="comp-item__label">{{ reg.label ?? reg.type }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.component-library {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.comp-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.comp-group__title {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--m-color-text-muted);
  letter-spacing: 0.04em;
  margin: 0 0 0 4px;
}

.comp-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.comp-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 6px 10px;
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-md);
  background: var(--m-color-surface);
  cursor: grab;
  text-align: center;
  user-select: none;
}

.comp-item:hover {
  border-color: var(--m-color-primary);
  background: color-mix(in srgb, var(--m-color-primary) 6%, transparent);
  box-shadow: var(--m-shadow-card-hover);
}

.comp-item:active {
  cursor: grabbing;
}

.comp-item__icon {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--m-radius-sm);
  background: color-mix(in srgb, var(--m-color-primary) 10%, transparent);
  color: var(--m-color-primary);
}

.comp-item__label {
  font-size: 12px;
  color: var(--m-color-text-muted);
}
</style>
