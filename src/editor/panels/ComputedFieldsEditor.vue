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

    <div v-for="(f, i) in list" :key="i" class="cf-editor__item">
      <div class="cf-editor__row">
        <span class="cf-editor__label">名称</span>
        <input
          :value="f.name"
          class="cf-editor__name-input"
          placeholder="新字段名"
          @input="patch(i, 'name', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div>
        <textarea
          :value="f.expr"
          class="cf-editor__expr-input"
          rows="2"
          placeholder="表达式，如 revenue - cost"
          @input="patch(i, 'expr', ($event.target as HTMLTextAreaElement).value)"
        />
      </div>
      <div v-if="profiles?.length" class="cf-editor__profiles">
        <button
          v-for="p in profiles.slice(0, 8)"
          :key="p.key"
          type="button"
          class="cf-editor__profile"
          @click="insertField(i, p.key)"
        >
          {{ p.key }}
        </button>
      </div>
      <div class="cf-editor__footer">
        <MButton type="text" size="small" danger @click="remove(i)">删除</MButton>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.cf-editor {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;

  &__templates {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  &__empty {
    font-size: 0.75rem;
    line-height: 1rem;
    color: var(--m-color-text-muted);
  }

  &__item {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    border-radius: var(--m-radius-md);
    border: 1px solid var(--m-color-border);
    background: var(--m-color-surface);
    padding: 0.625rem;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  &__label {
    flex: none;
    font-size: 0.75rem;
    line-height: 1rem;
    color: var(--m-color-text-muted);
  }

  &__profiles {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  &__profile {
    cursor: pointer;
    border-radius: 9999px;
    border: 1px solid var(--m-color-border);
    background: var(--m-color-fill-light);
    padding: 1px 0.5rem;
    font-size: 11px;
    color: var(--m-color-text);
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
  }
}

.cf-editor__name-input,
.cf-editor__expr-input {
  border-radius: var(--m-radius-sm);
  border: 1px solid var(--m-color-border);
  outline: none;

  &:focus {
    border-color: var(--m-color-primary);
  }
}

.cf-editor__name-input {
  min-width: 0;
  flex: 1;
  padding: 0.25rem 0.5rem;
  font-size: 12.5px;
}

.cf-editor__expr-input {
  width: 100%;
  resize: vertical;
  padding: 0.375rem 0.5rem;
  font-family: var(--m-font-mono, monospace);
  font-size: 0.75rem;
  line-height: 1rem;
}
</style>
