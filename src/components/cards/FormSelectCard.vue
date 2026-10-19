<script setup lang="ts">
/**
 * 表单下拉卡（formSelect）
 * 对齐 go-view InputsSelect：大屏筛选下拉。
 */

import { computed, ref } from 'vue'
import { MSelect } from 'morya-ui'
import type { CardProps } from './types'

const props = defineProps<CardProps>()

const cfg = computed(() => props.schema.formSelect ?? {})
const value = ref<string | undefined>(undefined)
</script>

<template>
  <div class="form-select-card">
    <label v-if="cfg.label" class="form-select-card__label">{{ cfg.label }}</label>
    <MSelect
      v-model="value"
      :options="cfg.options ?? []"
      :placeholder="cfg.placeholder ?? '请选择'"
      allow-clear
      fluid
    />
  </div>
</template>

<style scoped>
.form-select-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
}

.form-select-card__label {
  font-size: 13px;
  color: var(--m-color-text-muted);
}
</style>
