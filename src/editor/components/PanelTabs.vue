<script setup lang="ts">
/**
 * 面板页签（按钮式，无第三方控件依赖，保证切换可靠）
 * 左侧面板与右侧面板共用。
 */

import SvgIcon from '../../components/common/SvgIcon.vue'

defineProps<{
  modelValue: string
  options: { label: string; value: string; icon?: string }[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()
</script>

<template>
  <div class="panel-tabs" role="tablist">
    <button
      v-for="o in options"
      :key="o.value"
      type="button"
      role="tab"
      class="panel-tabs__item"
      :class="{ 'is-active': o.value === modelValue }"
      :aria-selected="o.value === modelValue"
      @click="emit('update:modelValue', o.value)"
    >
      <SvgIcon v-if="o.icon" :name="o.icon" :px="13" />
      <span>{{ o.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.panel-tabs {
  display: flex;
  gap: 2px;
  padding: 3px;
  background: color-mix(in srgb, var(--m-color-text-muted) 8%, var(--m-color-surface));
  border-radius: var(--m-radius-control, var(--m-radius-md));
}

.panel-tabs__item {
  flex: 1 1 0;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 8px;
  border: none;
  border-radius: var(--m-radius-sm);
  background: transparent;
  color: var(--m-color-text-muted);
  font-size: 12.5px;
  font-family: var(--m-font-sans);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}

.panel-tabs__item:hover {
  color: var(--m-color-text);
}

.panel-tabs__item.is-active {
  background: var(--m-color-surface);
  color: var(--m-color-text);
  box-shadow: var(--m-shadow-sm);
}
</style>
