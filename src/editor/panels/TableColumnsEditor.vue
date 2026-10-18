<script setup lang="ts">
/**
 * 表格列编辑器（table.columns）
 * 把绑定数据源的字段（维度 / 指标）勾选为表格列；可选改列标题。
 * 用于打通「数据源字段 → 表格渲染」：勾选的字段会生成 TableColumn[] 落到卡片配置。
 */

import { computed } from 'vue'
import { MCheckbox, MInput, MTag } from 'morya-ui'
import type { TableColumn } from '../../types/schema'
import type { FieldDescriptor } from '../../data/fields'

const props = defineProps<{
  modelValue: TableColumn[]
  dataFields: FieldDescriptor[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: TableColumn[]): void
}>()

const selectedKeys = computed<Set<string>>(() =>
  new Set(props.modelValue.map(c => c.key)),
)

const ROLE_TAG: Record<FieldDescriptor['role'], 'primary' | 'success' | 'info'> = {
  dimension: 'info',
  time: 'success',
  metric: 'primary',
}

const ROLE_LABEL: Record<FieldDescriptor['role'], string> = {
  dimension: '维度',
  time: '时间',
  metric: '指标',
}

function toggle(name: string, checked: boolean) {
  const next = [...props.modelValue]
  if (checked) {
    next.push({ key: name, title: name })
  } else {
    emit('update:modelValue', next.filter(c => c.key !== name))
    return
  }
  emit('update:modelValue', next)
}

function setTitle(key: string, title: string) {
  emit('update:modelValue', props.modelValue.map(c =>
    c.key === key ? { ...c, title: title || c.key } : c,
  ))
}

function titleOf(key: string): string {
  return props.modelValue.find(c => c.key === key)?.title ?? key
}
</script>

<template>
  <div class="table-columns-editor">
    <p v-if="!dataFields.length" class="tce-empty">绑定数据源后，这里会列出可作表格列的字段</p>
    <div
      v-for="f in dataFields"
      :key="f.name"
      class="tce-row"
      :class="{ 'is-checked': selectedKeys.has(f.name) }"
    >
      <MCheckbox
        size="small"
        :model-value="selectedKeys.has(f.name)"
        @update:model-value="toggle(f.name, $event)"
      />
      <span class="tce-name">{{ f.name }}</span>
      <MTag :type="ROLE_TAG[f.role]" size="small">{{ ROLE_LABEL[f.role] }}</MTag>
      <MInput
        v-if="selectedKeys.has(f.name)"
        class="tce-title"
        size="small"
        :model-value="titleOf(f.name)"
        :placeholder="f.name"
        @update:model-value="setTitle(f.name, $event as string)"
      />
    </div>
  </div>
</template>

<style scoped>
.table-columns-editor {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tce-empty {
  margin: 0;
  font-size: 12px;
  color: var(--m-color-text-muted);
}

.tce-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1.2fr);
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: var(--m-radius-sm);
}

.tce-row:hover {
  background: var(--m-color-split);
}

.tce-row.is-checked .tce-name {
  color: var(--m-color-primary);
}

.tce-name {
  font-size: 12px;
  color: var(--m-color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tce-title {
  min-width: 0;
}
</style>