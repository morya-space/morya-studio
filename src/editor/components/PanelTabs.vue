<script setup lang="ts">
/**
 * 面板页签（按钮式，无第三方控件依赖，保证切换可靠）
 * 左侧面板与右侧面板共用。
 */

import { getCurrentInstance, nextTick } from 'vue'
import SvgIcon from '../../components/common/SvgIcon.vue'

const props = defineProps<{
  modelValue: string
  options: { label: string; value: string; icon?: string }[]
  panelIdPrefix?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const tabIdPrefix = props.panelIdPrefix ?? `panel-tab-${getCurrentInstance()?.uid ?? 'panel'}`

function selectAndFocus(index: number) {
  const option = props.options[index]
  if (!option) return
  emit('update:modelValue', option.value)
  void nextTick(() => {
    document.querySelector<HTMLButtonElement>(`#${tabIdPrefix}-${option.value}`)?.focus()
  })
}

function onKeydown(e: KeyboardEvent, index: number) {
  const count = props.options.length
  if (!count) return
  let next: number | null = null
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % count
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index - 1 + count) % count
  if (e.key === 'Home') next = 0
  if (e.key === 'End') next = count - 1
  if (next === null) return
  e.preventDefault()
  selectAndFocus(next)
}
</script>

<template>
  <div class="panel-tabs" role="tablist">
    <button
      v-for="(o, index) in options"
      :key="o.value"
      :id="`${tabIdPrefix}-${o.value}`"
      type="button"
      role="tab"
      class="panel-tabs__item"
      :class="{ 'is-active': o.value === modelValue }"
      :aria-selected="o.value === modelValue"
      :aria-controls="panelIdPrefix ? `${panelIdPrefix}-panel-${o.value}` : undefined"
      :tabindex="o.value === modelValue ? 0 : -1"
      @click="emit('update:modelValue', o.value)"
      @keydown="onKeydown($event, index)"
    >
      <SvgIcon v-if="o.icon" :name="o.icon" :px="13" />
      <span>{{ o.label }}</span>
    </button>
  </div>
</template>

<style lang="scss" scoped>
.panel-tabs {
  display: flex;
  gap: 2px;
  padding: 3px;
  background: color-mix(in srgb, var(--m-color-text-muted) 8%, var(--m-color-surface));
  border-radius: var(--m-radius-control, var(--m-radius-md));

  &__item {
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

    &:hover {
      color: var(--m-color-text);
    }

    &.is-active {
      background: var(--m-color-surface);
      color: var(--m-color-text);
      box-shadow: var(--m-shadow-sm);
    }
  }
}
</style>
