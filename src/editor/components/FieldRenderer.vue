<script setup lang="ts">
/**
 * 字段渲染器
 * 根据 EditorFieldSchema 渲染对应 M* 控件，v-model 双向绑定。
 */

import { computed } from 'vue'
import { MInput, MSelect, MSwitch, MInputNumber, MTextarea, MColorPicker } from 'morya-ui'
import type { EditorFieldSchema } from '../../engine/registry'

const props = defineProps<{
  field: EditorFieldSchema
  modelValue: unknown
  /** 'auto:dataFields' 时从数据推断的字段选项 */
  dataFieldOptions?: { label: string; value: unknown }[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: unknown): void
}>()

const value = computed({
  get: () => props.modelValue,
  set: (v: unknown) => emit('update:modelValue', v),
})

const selectOptions = computed(() => {
  if (props.field.options === 'auto:dataFields') return props.dataFieldOptions ?? []
  return props.field.options ?? []
})
</script>

<template>
  <div class="field-renderer">
    <MSwitch
      v-if="field.component === 'MSwitch'"
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
    <MColorPicker
      v-else-if="field.component === 'MColorPicker'"
      v-model="(value as string)"
      format="hex"
      clearable
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
