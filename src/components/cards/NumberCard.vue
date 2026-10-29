<script setup lang="ts">
/**
 * 数字计数卡（number）
 * 对齐 go-view Number：滚动计数 + 前缀/后缀 + 精度/千分位。
 */

import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { formatValue } from '../../data/format'
import type { CardProps } from './types'

const props = defineProps<CardProps>()

const cfg = computed(() => props.schema.number ?? {})

const target = computed(() => {
  const c = cfg.value
  if (c.valueField && props.data[0]) return Number(props.data[0][c.valueField] ?? 0)
  return Number(c.value ?? 0)
})

const display = ref(0)
let raf = 0

function animate(to: number) {
  const from = Number(cfg.value.from ?? 0)
  const dur = Math.max(0, Number(cfg.value.duration ?? 0.8)) * 1000
  cancelAnimationFrame(raf)
  if (dur === 0 || typeof requestAnimationFrame === 'undefined') {
    display.value = to
    return
  }
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / dur)
    display.value = from + (to - from) * (1 - Math.pow(1 - t, 3))
    if (t < 1) raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

watch(target, v => animate(v), { immediate: true })
onBeforeUnmount(() => cancelAnimationFrame(raf))

const text = computed(() => {
  const c = cfg.value
  const precision = c.precision ?? 0
  const body = c.separator
    ? Number(display.value).toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision })
    : formatValue(display.value, 'number', precision)
  return `${c.prefix ?? ''}${body}${c.suffix ?? ''}`
})

const style = computed(() => ({
  fontSize: `${cfg.value.fontSize ?? 34}px`,
  color: cfg.value.color ?? 'var(--m-color-primary)',
}))
</script>

<template>
  <div class="number-card">
    <span class="number-card__value" :style="style">{{ text }}</span>
  </div>
</template>

<style lang="scss" scoped>
.number-card {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  &__value {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
    line-height: 1.1;
  }
}
</style>
