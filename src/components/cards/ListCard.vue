<script setup lang="ts">
/**
 * 列表卡（list）
 * 渲染 titleField/valueField 的键值列表，可选趋势。
 */

import { computed } from 'vue'
import CardShell from './CardShell.vue'
import { formatValue, getTrendType } from '../../data/format'
import type { CardProps, CardEmits } from './types'

const props = defineProps<CardProps>()
const emit = defineEmits<CardEmits>()

const listConfig = computed(() => props.schema.list)

function valueOf(row: Record<string, unknown>): string {
  const c = listConfig.value
  if (!c) return '-'
  return formatValue(row[c.valueField], c.valueType ?? 'number', 0)
}

function trendOf(row: Record<string, unknown>): { text: string; type: 'up' | 'down' } | null {
  const c = listConfig.value
  if (!c?.trendField) return null
  const raw = row[c.trendField]
  if (raw === undefined || raw === null) return null
  return { text: String(raw), type: getTrendType(raw) }
}
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
    <ul class="list-card">
      <li v-for="(row, i) in data" :key="i" class="list-card__item">
        <div class="list-card__main">
          <span class="list-card__title">{{ listConfig ? row[listConfig.titleField] : '' }}</span>
          <span v-if="listConfig?.subtitleField" class="list-card__subtitle">
            {{ row[listConfig.subtitleField] }}
          </span>
        </div>
        <div class="list-card__side">
          <span class="list-card__value">{{ valueOf(row) }}</span>
          <span
            v-if="trendOf(row)"
            class="list-card__trend"
            :class="`trend--${trendOf(row)!.type}`"
          >{{ trendOf(row)!.text }}</span>
        </div>
      </li>
    </ul>
  </CardShell>
</template>

<style lang="scss" scoped>
.list-card {
  list-style: none;
  margin: 0;
  padding: 0;
  height: 100%;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;

  &__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 0;
    border-bottom: 1px solid var(--m-color-split);

    &:last-child {
      border-bottom: none;
    }
  }

  &__main {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__title {
    font-size: 14px;
    font-weight: 600;
    color: var(--m-color-text);
  }

  &__subtitle {
    font-size: 12px;
    color: var(--m-color-text-muted);
  }

  &__side {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  &__value {
    font-size: 14px;
    font-weight: 600;
    color: var(--m-color-text);
  }

  &__trend {
    font-size: 12px;
    font-weight: 600;
    padding: 1px 8px;
    border-radius: var(--m-radius-full, 999px);
  }
}

.trend {
  &--up {
    color: var(--m-color-success);
    background: color-mix(in srgb, var(--m-color-success) 12%, transparent);
  }

  &--down {
    color: var(--m-color-accent-pink);
    background: color-mix(in srgb, var(--m-color-accent-pink) 12%, transparent);
  }
}
</style>
