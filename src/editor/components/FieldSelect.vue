<script setup lang="ts">
/**
 * 字段选择器
 * 单/多选一体（multiple 时 value 为 string[]），支持关键字搜索；
 * 选项按「兼容 / 不兼容」分组，后缀显示样例值。
 */

import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { FieldProfile } from '../../data/field-profile'
import type { DataFieldType } from '../../engine/data-role'

const props = defineProps<{
  profiles: readonly FieldProfile[]
  acceptedTypes: readonly DataFieldType[]
  value?: string | string[]
  multiple?: boolean
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:value': [string | string[]]
}>()

const open = ref(false)
const keyword = ref('')

const isMultiple = computed(() => Boolean(props.multiple))

function selectedArray(): string[] {
  if (props.value === undefined || props.value === null) return []
  return Array.isArray(props.value) ? props.value : [props.value]
}

const selected = computed<string[]>(selectedArray)

function isCompatible(p: FieldProfile): boolean {
  return props.acceptedTypes.includes(p.valueKind)
}

const kw = computed(() => keyword.value.trim().toLowerCase())

const filtered = computed(() => {
  if (!kw.value) return props.profiles
  return props.profiles.filter(p =>
    p.key.toLowerCase().includes(kw.value) || p.label.toLowerCase().includes(kw.value),
  )
})

const compatible = computed(() => filtered.value.filter(isCompatible))
const incompatible = computed(() => filtered.value.filter(p => !isCompatible(p)))

function sampleText(p: FieldProfile): string {
  return p.sampleValues.length
    ? p.sampleValues.map(v => String(v)).join(' / ')
    : ''
}

function isChecked(key: string): boolean {
  return selected.value.includes(key)
}

function toggle(key: string): void {
  if (props.disabled) return
  if (isMultiple.value) {
    const next = isChecked(key)
      ? selected.value.filter(k => k !== key)
      : [...selected.value, key]
    emit('update:value', next)
    return
  }
  emit('update:value', isChecked(key) ? '' : key)
  open.value = false
  keyword.value = ''
}

function onClear(): void {
  emit('update:value', isMultiple.value ? [] : '')
}

const labelMap = computed(() => new Map(props.profiles.map(p => [p.key, p])))

const displayText = computed(() =>
  selected.value
    .map(k => labelMap.value.get(k)?.label ?? k)
    .join(', '),
)

const root = ref<HTMLElement | null>(null)

function onDocClick(e: MouseEvent): void {
  if (root.value && !root.value.contains(e.target as Node)) {
    open.value = false
    keyword.value = ''
  }
}

onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick))
</script>

<template>
  <div ref="root" class="field-select" :class="{ 'is-open': open, 'is-disabled': disabled }">
    <button
      type="button"
      class="field-select__control"
      :disabled="disabled"
      @click="open = !open"
    >
      <span v-if="displayText" class="field-select__text">{{ displayText }}</span>
      <span v-else class="field-select__placeholder">{{ placeholder ?? '选择字段' }}</span>
      <span
        v-if="selected.length"
        class="field-select__clear"
        role="button"
        aria-label="clear"
        @click.stop="onClear"
      />
      <span class="field-select__arrow" />
    </button>

    <div v-if="open && !disabled" class="field-select__panel" @mousedown.prevent>
      <div class="field-select__search">
        <input v-model="keyword" type="text" placeholder="搜索字段名…" />
      </div>
      <div class="field-select__list">
        <template v-if="compatible.length">
          <p v-if="incompatible.length" class="field-select__group">兼容字段</p>
          <button
            v-for="p in compatible"
            :key="p.key"
            type="button"
            class="field-select__option"
            :class="{ 'is-checked': isChecked(p.key) }"
            @click="toggle(p.key)"
          >
            <span class="field-select__check">{{ isChecked(p.key) ? '✓' : '' }}</span>
            <span class="field-select__option-body">
              <span class="field-select__option-label">{{ p.label }}</span>
              <span class="field-select__option-meta">
                {{ p.key }} · {{ p.valueKind }}<template v-if="sampleText(p)"> · {{ sampleText(p) }}</template>
              </span>
            </span>
          </button>
        </template>

        <template v-if="incompatible.length">
          <p class="field-select__group">不兼容</p>
          <button
            v-for="p in incompatible"
            :key="p.key"
            type="button"
            class="field-select__option is-incompatible"
            :class="{ 'is-checked': isChecked(p.key) }"
            @click="toggle(p.key)"
          >
            <span class="field-select__check">{{ isChecked(p.key) ? '✓' : '' }}</span>
            <span class="field-select__option-body">
              <span class="field-select__option-label">{{ p.label }}</span>
              <span class="field-select__option-meta">
                {{ p.key }} · {{ p.valueKind }}<template v-if="sampleText(p)"> · {{ sampleText(p) }}</template>
              </span>
            </span>
          </button>
        </template>

        <p v-if="!filtered.length" class="field-select__empty">无匹配字段</p>
      </div>
      <p v-if="multiple" class="field-select__hint">可多选：{{ selected.length }} 项已选</p>
    </div>
  </div>
</template>

<style scoped>
.field-select {
  position: relative;
  width: 100%;
}

.field-select__control {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 24px 4px 10px;
  min-height: 28px;
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-sm);
  background: var(--m-color-surface);
  cursor: pointer;
  font-size: 12.5px;
  color: var(--m-color-text);
  text-align: left;
}

.field-select.is-open .field-select__control {
  border-color: var(--m-color-primary);
}

.field-select__text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field-select__placeholder {
  flex: 1;
  color: var(--m-color-text-muted);
}

.field-select__clear {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--m-color-text-muted);
  position: relative;
  flex: none;
}

.field-select__clear::before,
.field-select__clear::after {
  content: '';
  position: absolute;
  left: 6px;
  top: 3px;
  width: 2px;
  height: 8px;
  background: var(--m-color-surface);
}

.field-select__clear::before { transform: rotate(45deg); }
.field-select__clear::after { transform: rotate(-45deg); }

.field-select__arrow {
  position: absolute;
  right: 10px;
  top: 50%;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid var(--m-color-text-muted);
  transform: translateY(-50%);
  pointer-events: none;
}

.field-select__panel {
  position: absolute;
  z-index: 30;
  left: 0;
  right: 0;
  top: calc(100% + 4px);
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-md);
  background: var(--m-color-surface);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
}

.field-select__search {
  padding: 8px;
  border-bottom: 1px solid var(--m-color-split);
}

.field-select__search input {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-sm);
  font-size: 12px;
  outline: none;
}

.field-select__search input:focus {
  border-color: var(--m-color-primary);
}

.field-select__list {
  max-height: 240px;
  overflow: auto;
  padding: 4px;
  display: flex;
  flex-direction: column;
}

.field-select__group {
  margin: 6px 4px 2px;
  font-size: 11px;
  color: var(--m-color-text-muted);
}

.field-select__option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border: none;
  border-radius: var(--m-radius-sm);
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.field-select__option:hover {
  background: var(--m-color-fill-light);
}

.field-select__option.is-checked {
  background: color-mix(in srgb, var(--m-color-primary) 12%, transparent);
}

.field-select__check {
  width: 14px;
  font-size: 12px;
  color: var(--m-color-primary);
  flex: none;
  line-height: 1.4;
}

.field-select__option-body {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.field-select__option-label {
  font-size: 12.5px;
  color: var(--m-color-text);
}

.field-select__option-meta {
  font-size: 11px;
  color: var(--m-color-text-muted);
  word-break: break-all;
}

.field-select__option.is-incompatible .field-select__option-label {
  color: var(--m-color-text-muted);
}

.field-select__empty {
  margin: 8px;
  font-size: 12px;
  color: var(--m-color-text-muted);
  text-align: center;
}

.field-select__hint {
  margin: 0;
  padding: 6px 10px;
  border-top: 1px solid var(--m-color-split);
  font-size: 11px;
  color: var(--m-color-text-muted);
}

.is-disabled .field-select__control {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
