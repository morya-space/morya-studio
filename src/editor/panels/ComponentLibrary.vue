<script setup lang="ts">
/**
 * 组件库面板
 * 列出所有已注册卡片类型，支持拖拽到画布 / 点击添加。
 */

import { getAllRegistrations } from '../../engine/registry'
import type { CardType } from '../../types/schema'
import { useEditorStore } from '../store'
import SvgIcon from '../../components/common/SvgIcon.vue'

const store = useEditorStore()
const registrations = getAllRegistrations()

function onDragStart(event: DragEvent, type: CardType) {
  if (!event.dataTransfer) return
  event.dataTransfer.setData('card-type', type)
  event.dataTransfer.effectAllowed = 'copy'
}

function onClickAdd(type: CardType) {
  store.addCard(type)
}
</script>

<template>
  <div class="component-library">
    <p class="panel-tip">拖拽或点击添加到画布</p>
    <div class="component-grid">
      <button
        v-for="reg in registrations"
        :key="reg.type"
        class="component-item"
        draggable="true"
        @dragstart="onDragStart($event, reg.type)"
        @click="onClickAdd(reg.type)"
      >
        <span class="component-icon">
          <SvgIcon :name="reg.icon ?? 'grid'" :px="20" />
        </span>
        <span class="component-label">{{ reg.label ?? reg.type }}</span>
        <span class="component-desc">{{ reg.description ?? '' }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.component-library {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel-tip {
  font-size: 12px;
  color: var(--m-color-text-muted);
  margin: 0;
}

.component-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.component-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 10px;
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-md);
  background: var(--m-color-surface);
  cursor: grab;
  text-align: center;
  transition: border-color var(--m-motion-fast, 0.15s), box-shadow var(--m-motion-fast, 0.15s);
}

.component-item:hover {
  border-color: var(--m-color-primary);
  box-shadow: var(--m-shadow-card-hover);
}

.component-item:active {
  cursor: grabbing;
}

.component-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--m-radius-sm);
  background: color-mix(in srgb, var(--m-color-primary) 10%, transparent);
  color: var(--m-color-primary);
}

.component-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--m-color-text);
}

.component-desc {
  font-size: 11px;
  color: var(--m-color-text-muted);
  line-height: 1.3;
}
</style>
