<script setup lang="ts">
/**
 * 计算列编辑器
 * 新增/删除派生字段：字段名 + 表达式；提供常用模板，点字段可插入表达式。
 * 卡片内联数据源与数据源详情页共用。表达式直接写字段名，如 revenue - cost。
 */

import { computed } from 'vue'
import { MButton } from 'morya-ui'
import type { ComputedField } from '../../types/schema'
import type { FieldProfile } from '../../data/field-profile'

const props = defineProps<{
  fields: ComputedField[]
  profiles?: readonly FieldProfile[]
}>()

const emit = defineEmits<{
  'update:fields': [ComputedField[]]
}>()

const list = computed<ComputedField[]>({
  get: () => props.fields,
  set: v => emit('update:fields', v),
})

const TEMPLATES: { label: string; make: () => ComputedField }[] = [
  { label: '四则运算', make: () => ({ name: 'newField', expr: 'a - b' }) },
  { label: '比率', make: () => ({ name: 'ratio', expr: 'part / total * 100' }) },
  { label: '字符串拼接', make: () => ({ name: 'fullName', expr: "firstName + ' ' + lastName" }) },
  { label: '条件值', make: () => ({ name: 'flag', expr: "value >= 60 ? '达标' : '未达标'" }) },
]

function add(tpl?: ComputedField): void {
  const base = tpl ?? { name: `field_${list.value.length + 1}`, expr: '' }
  emit('update:fields', [...list.value, { ...base }])
}

function remove(index: number): void {
  emit('update:fields', list.value.filter((_, i) => i !== index))
}

function patch(index: number, key: keyof ComputedField, value: string): void {
  emit('update:fields', list.value.map((f, i) => (i === index ? { ...f, [key]: value } : f)))
}

function insertField(index: number, key: string): void {
  const current = list.value[index]
  const expr = current.expr ?? ''
  const glue = expr && !/\s$/.test(expr) ? ' ' : ''
  patch(index, 'expr', `${expr}${glue}${key}`)
}
</script>

<template>
  <div class="cf-editor">
    <div class="cf-editor__templates">
      <MButton
        v-for="t in TEMPLATES"
        :key="t.label"
        type="default"
        size="small"
        @click="add(t.make())"
      >
        + {{ t.label }}
      </MButton>
      <MButton type="text" size="small" @click="add()">自定义</MButton>
    </div>

    <div v-if="!list.length" class="cf-editor__empty">暂无计算列，从模板添加或自定义</div>

    <div v-for="(f, i) in list" :key="i" class="cf-editor__row">
      <div class="cf-editor__name">
        <span class="cf-editor__name-label">名称</span>
        <input
          :value="f.name"
          placeholder="新字段名"
          @input="patch(i, 'name', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="cf-editor__expr">
        <textarea
          :value="f.expr"
          rows="2"
          placeholder="表达式，如 revenue - cost"
          @input="patch(i, 'expr', ($event.target as HTMLTextAreaElement).value)"
        />
      </div>
      <div v-if="profiles?.length" class="cf-editor__fields">
        <button
          v-for="p in profiles.slice(0, 8)"
          :key="p.key"
          type="button"
          class="cf-editor__field"
          @click="insertField(i, p.key)"
        >
          {{ p.key }}
        </button>
      </div>
      <div class="cf-editor__row-actions">
        <MButton type="text" size="small" danger @click="remove(i)">删除</MButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cf-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cf-editor__templates {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cf-editor__empty {
  font-size: 12px;
  color: var(--m-color-text-muted);
}

.cf-editor__row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-md);
  background: var(--m-color-surface);
}

.cf-editor__name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cf-editor__name-label {
  font-size: 12px;
  color: var(--m-color-text-muted);
  flex: none;
}

.cf-editor__name input {
  flex: 1;
  min-width: 0;
  padding: 4px 8px;
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-sm);
  font-size: 12.5px;
  outline: none;
}

.cf-editor__name input:focus {
  border-color: var(--m-color-primary);
}

.cf-editor__expr textarea {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-sm);
  font-size: 12px;
  font-family: var(--m-font-mono, monospace);
  resize: vertical;
  outline: none;
}

.cf-editor__expr textarea:focus {
  border-color: var(--m-color-primary);
}

.cf-editor__fields {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.cf-editor__field {
  padding: 1px 8px;
  border: 1px solid var(--m-color-border);
  border-radius: 999px;
  background: var(--m-color-fill-light);
  font-size: 11px;
  color: var(--m-color-text);
  cursor: pointer;
}

.cf-editor__row-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
