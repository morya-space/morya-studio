<script setup lang="ts">
/**
 * 词云卡（wordCloud）
 * 对齐 go-view WordCloud：按数值排布字号，自动换行。
 */

import { computed } from 'vue'
import type { CardProps } from './types'

const props = defineProps<CardProps>()

const cfg = computed(() => props.schema.wordCloud ?? {})
const textField = computed(() => cfg.value.textField ?? 'name')
const valueField = computed(() => cfg.value.valueField ?? 'value')
const minSize = computed(() => cfg.value.minSize ?? 14)
const maxSize = computed(() => cfg.value.maxSize ?? 34)

const words = computed(() => {
  const rows = [...props.data]
  const list = rows.map(r => ({
    text: String(r[textField.value] ?? ''),
    value: Number(r[valueField.value] ?? 0),
  })).filter(w => w.text)
  list.sort((a, b) => b.value - a.value)
  return list
})

function sizeOf(index: number): number {
  const n = Math.max(1, words.value.length)
  const ratio = 1 - index / n
  return Math.round(minSize.value + (maxSize.value - minSize.value) * ratio)
}
</script>

<template>
  <div class="word-cloud-card" :style="cfg.color ? { color: cfg.color } : {}">
    <span
      v-for="(w, i) in words"
      :key="w.text"
      class="word-cloud-card__word"
      :style="{ fontSize: `${sizeOf(i)}px`, opacity: 0.55 + 0.45 * (1 - i / Math.max(1, words.length)) }"
      :title="`${w.text}: ${w.value}`"
    >{{ w.text }}</span>
    <span v-if="!words.length" class="word-cloud-card__empty">暂无数据</span>
  </div>
</template>

<style lang="scss" scoped>
.word-cloud-card {
  height: 100%;
  display: flex;
  flex-wrap: wrap;
  align-content: center;
  justify-content: center;
  gap: 6px 14px;
  overflow: hidden;
  color: var(--m-color-primary);

  &__word {
    font-weight: 700;
    line-height: 1.1;
    white-space: nowrap;
  }

  &__empty {
    color: var(--m-color-text-muted);
    font-size: 13px;
  }
}
</style>
