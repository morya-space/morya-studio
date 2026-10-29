<script setup lang="ts">
/**
 * 表单输入卡（formInput）
 * 对齐 go-view InputsInput：大屏筛选输入框。
 */

import { computed, ref } from 'vue'
import { MInput } from 'morya-ui'
import type { CardProps } from './types'

const props = defineProps<CardProps>()

const cfg = computed(() => props.schema.formInput ?? {})
const value = ref('')
</script>

<template>
  <div class="form-input-card">
    <label v-if="cfg.label" class="form-input-card__label">{{ cfg.label }}</label>
    <MInput v-model="value" :placeholder="cfg.placeholder ?? '请输入'" fluid />
  </div>
</template>

<style lang="scss" scoped>
.form-input-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;

  &__label {
    font-size: 13px;
    color: var(--m-color-text-muted);
  }
}
</style>
