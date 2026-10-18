<script setup lang="ts">
/**
 * 字段渲染器
 * 根据 EditorFieldSchema 渲染对应 M* 控件，v-model 双向绑定。
 * - options 'auto:*' 时按模式选择字段列表（全部 / 维度优先 / 指标优先）
 * - component 'MTableColumns' 时渲染表格列编辑器
 */

import { computed } from 'vue'
import { MInput, MSelect, MSwitch, MInputNumber, MTextarea } from 'morya-ui'
import type { EditorFieldSchema } from '../../engine/registry'
import type { FieldDescriptor } from '../../data/fields'
import type { TableColumn } from '../../types/schema'
import TableColumnsEditor from '../../editor/panels/TableColumnsEditor.vue'

const props = defineProps<{
  field: EditorFieldSchema
  modelValue: unknown
  /** 'auto:dataFields' 时从数据推断的字段选项 */
  dataFieldOptions?: { label: string; value: unknown }[]
  /** 'auto:dimensionFields' 时的维度优先选项 */
  dimensionFieldOptions?: { label: string; value: unknown }[]
  /** 'auto:metricFields' 时的指标优先选项 */
  metricFieldOptions?: { label: string; value: unknown }[]
  /** 字段描述符（供表格列编辑器 / 类型徽标使用） */
  fieldDescriptors?: FieldDescriptor[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: unknown): void
}>()

const value = computed({
  get: () => props.modelValue,
  set: (v: unknown) => emit('update:modelValue', v),
})

const selectOptions = computed(() => {
  if (props.field.options === 'auto:dimensionFields') return props.dimensionFieldOptions ?? []
  if (props.field.options === 'auto:metricFields') return props.metricFieldOptions ?? []
  if (props.field.options === 'auto:dataFields') return props.dataFieldOptions ?? []
  return props.field.options ?? []
})

/** 表格列数组（供 MTableColumns 双向绑定） */
const tableColumns = computed<TableColumn[]>({
  get: () => (Array.isArray(props.modelValue) ? props.modelValue as TableColumn[] : []),
  set: (v) => emit('update:modelValue', v),
})
</script>

<template>
  <div class="field-renderer">
    <TableColumnsEditor
      v-if="field.component === 'MTableColumns'"
      v-model="tableColumns"
      :data-fields="fieldDescriptors ?? []"
    />
    <MSwitch
      v-else-if="field.component === 'MSwitch'"
      v-model="(value as boolean)"
    />
    <MInputNumber
      v-else-if="field.component === 'MInputNumber'"
      v-model="(value as number)"
      fluid
      v-bind="field.props"
    />
    <MSelect
      v-else-if="field.component === 'MSelect'"
      v-model="(value as string | number | undefined)"
      :options="selectOptions"
      fluid
      allow-clear
      v-bind="field.props"
    />
    <MTextarea
      v-else-if="field.component === 'MTextarea'"
      v-model="(value as string)"
      :rows="3"
      fluid
      v-bind="field.props"
    />
    <MInput
      v-else
      v-model="(value as string)"
      fluid
      v-bind="field.props"
    />
  </div>
</template>