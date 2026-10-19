<script setup lang="ts">
/**
 * 时间卡（time）
 * 对齐 go-view TimeCommon：实时时钟 + 自定义格式。
 */

import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { CardProps } from './types'

const props = defineProps<CardProps>()

const now = ref(Date.now())
let timer: number | undefined

onMounted(() => {
  timer = window.setInterval(() => { now.value = Date.now() }, 1000)
})
onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
})

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function formatDate(ts: number, fmt: string): string {
  const d = new Date(ts)
  return fmt
    .replace('YYYY', String(d.getFullYear()))
    .replace('MM', pad(d.getMonth() + 1))
    .replace('DD', pad(d.getDate()))
    .replace('HH', pad(d.getHours()))
    .replace('mm', pad(d.getMinutes()))
    .replace('ss', pad(d.getSeconds()))
}

const cfg = computed(() => props.schema.time ?? {})
const text = computed(() => formatDate(now.value, cfg.value.format ?? 'YYYY-MM-DD HH:mm:ss'))
const style = computed(() => ({
  fontSize: `${cfg.value.fontSize ?? 22}px`,
  color: cfg.value.color ?? 'var(--m-color-text)',
  fontWeight: cfg.value.bold ? 700 : 500,
}))
</script>

<template>
  <div class="time-card">
    <span class="time-card__value" :style="style">{{ text }}</span>
  </div>
</template>

<style scoped>
.time-card {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.time-card__value {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}
</style>
