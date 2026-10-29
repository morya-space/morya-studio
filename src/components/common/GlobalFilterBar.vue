<script setup lang="ts">
/**
 * 页面全局过滤器栏
 * 按 PageSchema.filters 渲染参数控件，变化时 emit 最新参数（注入数据源 {{var}}）。
 */

import { reactive, watch } from 'vue'
import { MButton, MDatePicker, MInput, MInputNumber, MSelect } from 'morya-ui'
import type { PageFilter } from '../../types/schema'

const props = defineProps<{
  filters: PageFilter[]
}>()

const emit = defineEmits<{
  (e: 'change', params: Record<string, unknown>): void
}>()

const values = reactive<Record<string, unknown>>({})

function initValues() {
  for (const key of Object.keys(values)) delete values[key]
  for (const f of props.filters) {
    if (f.defaultValue !== undefined && f.defaultValue !== '') values[f.key] = f.defaultValue
  }
}

initValues()

watch(
  () => props.filters.map(f => `${f.key}:${f.defaultValue ?? ''}`).join('|'),
  () => initValues(),
)

watch(values, () => {
  emit('change', { ...values })
}, { deep: true, immediate: true })

function onReset() {
  initValues()
}
</script>

<template>
  <div v-if="filters.length" class="global-filter-bar">
    <div class="global-filter-bar__items">
      <label v-for="f in filters" :key="f.key" class="global-filter-bar__item">
        <span class="global-filter-bar__label">{{ f.label }}</span>
        <MSelect
          v-if="f.type === 'select'"
          v-model="values[f.key] as string | undefined"
          :options="f.options ?? []"
          clearable
          placeholder="全部"
          fluid
        />
        <MDatePicker
          v-else-if="f.type === 'date'"
          v-model="values[f.key] as string | null"
          type="date"
          clearable
          fluid
        />
        <MInputNumber
          v-else-if="f.type === 'number'"
          v-model="values[f.key] as number | null"
          fluid
        />
        <MInput
          v-else
          v-model="values[f.key] as string"
          placeholder="全部"
          clearable
          fluid
        />
      </label>
    </div>
    <MButton type="text" size="small" @click="onReset">重置</MButton>
  </div>
</template>

<style lang="scss" scoped>
.global-filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 16px;
  border-radius: var(--m-radius-lg);
  background: var(--m-color-surface);
  box-shadow: var(--m-shadow-card);

  &__items {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 16px;
  }

  &__item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 160px;
  }

  &__label {
    font-size: 12px;
    color: var(--m-color-text-muted);
  }
}
</style>
