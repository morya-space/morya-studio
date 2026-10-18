<script setup lang="ts">
/**
 * 指标卡（stat）
 * 显示单个核心数值 + 可选趋势徽章。
 * 数据取 data 第一行，字段由 schema.stat 配置。
 */

import { computed } from 'vue'
import CardShell from './CardShell.vue'
import { formatValue, getTrendType } from '../../data/format'
import type { CardProps, CardEmits } from './types'

const props = defineProps<CardProps>()
const emit = defineEmits<CardEmits>()

const stat = computed(() => props.schema.stat)
const row = computed(() => props.data[0] ?? {})

const value = computed(() => {
  const s = stat.value
  if (!s) return '-'
  const raw = row.value[s.valueField]
  const formatted = formatValue(raw, 'number', s.precision ?? 0)
  return `${s.prefix ?? ''}${formatted}${s.suffix ?? ''}`
})

const label = computed(() => {
  const s = stat.value
  if (!s) return ''
  if (s.labelField) return String(row.value[s.labelField] ?? '')
  return props.schema.title ?? ''
})

const trend = computed(() => {
  const s = stat.value
  if (!s?.trendField) return null
  const raw = row.value[s.trendField]
  if (raw === undefined || raw === null) return null
  const type = s.trendType === 'auto' || !s.trendType ? getTrendType(raw) : s.trendType
  return { text: String(raw), type }
})
</script>

<template>
  <CardShell
    :title="schema.title"
    :subtitle="schema.subtitle"
    :loading="loading"
    :error="error"
    :empty="data.length === 0"
    :state-text="schema.stateText"
    :actions="schema.actions"
    @retry="emit('retry')"
    @action="emit('action', $event)"
  >
    <div class="stat-card">
      <p class="stat-card__label">{{ label }}</p>
      <div class="stat-card__value-row">
        <span class="stat-card__value">{{ value }}</span>
        <span
          v-if="trend"
          class="stat-card__trend"
          :class="`trend--${trend.type}`"
        >{{ trend.text }}</span>
      </div>
    </div>
  </CardShell>
</template>

<style scoped>
.stat-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
}

.stat-card__label {
  font-size: 13px;
  color: var(--m-color-text-muted);
  margin: 0;
}

.stat-card__value-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-card__value {
  font-size: 28px;
  font-weight: 700;
  color: var(--m-color-text);
}

.stat-card__trend {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: var(--m-radius-full, 999px);
}

.trend--up {
  color: var(--m-color-success);
  background: color-mix(in srgb, var(--m-color-success) 12%, transparent);
}

.trend--down {
  color: var(--m-color-accent-pink);
  background: color-mix(in srgb, var(--m-color-accent-pink) 12%, transparent);
}
</style>
