<script setup lang="ts">
/**
 * 表单页签卡（formTabs）
 * 对齐 go-view InputsTab：大屏分段/页签切换。
 */

import { computed, ref, watch } from 'vue'
import { MSegmented } from 'morya-ui'
import type { CardProps } from './types'

const props = defineProps<CardProps>()

const cfg = computed(() => props.schema.formTabs ?? {})
const options = computed(() =>
  (cfg.value.tabs ?? []).map(t => ({ label: t, value: t })),
)
const active = ref<string>('')

watch(options, opts => {
  if (opts.length && !opts.some(o => o.value === active.value)) active.value = opts[0].value
}, { immediate: true })
</script>

<template>
  <div class="form-tabs-card">
    <MSegmented v-if="options.length" v-model="active" :options="options" block />
    <span v-else class="form-tabs-card__empty">未配置页签</span>
  </div>
</template>

<style scoped>
.form-tabs-card {
  height: 100%;
  display: flex;
  align-items: center;
}

.form-tabs-card__empty {
  width: 100%;
  text-align: center;
  color: var(--m-color-text-muted);
  font-size: 12px;
}
</style>
