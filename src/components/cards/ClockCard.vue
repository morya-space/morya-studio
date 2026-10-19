<script setup lang="ts">
/**
 * 时钟卡（clock）
 * 对齐 go-view Clock：数字 / 指针两种模式。
 */

import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { CardProps } from './types'

const props = defineProps<CardProps>()

const now = ref(Date.now())
let timer: number | undefined

onMounted(() => { timer = window.setInterval(() => { now.value = Date.now() }, 1000) })
onBeforeUnmount(() => { if (timer) window.clearInterval(timer) })

const cfg = computed(() => props.schema.clock ?? {})
const date = computed(() => new Date(now.value))

function pad(n: number) { return String(n).padStart(2, '0') }
function formatDate(d: Date, fmt: string): string {
  return fmt
    .replace('YYYY', String(d.getFullYear()))
    .replace('MM', pad(d.getMonth() + 1))
    .replace('DD', pad(d.getDate()))
    .replace('HH', pad(d.getHours()))
    .replace('mm', pad(d.getMinutes()))
    .replace('ss', pad(d.getSeconds()))
}

const digital = computed(() => formatDate(date.value, cfg.value.format ?? 'YYYY-MM-DD HH:mm:ss'))

const secondsDeg = computed(() => date.value.getSeconds() * 6)
const minutesDeg = computed(() => date.value.getMinutes() * 6 + date.value.getSeconds() * 0.1)
const hoursDeg = computed(() => (date.value.getHours() % 12) * 30 + date.value.getMinutes() * 0.5)
</script>

<template>
  <div class="clock-card" :style="{ color: cfg.color ?? 'var(--m-color-primary)' }">
    <span v-if="(cfg.mode ?? 'digital') === 'digital'" class="clock-card__digital" :style="{ fontSize: `${cfg.fontSize ?? 24}px` }">
      {{ digital }}
    </span>
    <svg v-else class="clock-card__analog" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="2" opacity="0.35" />
      <line x1="50" y1="50" x2="50" y2="26" stroke="currentColor" stroke-width="3" stroke-linecap="round"
        :transform="`rotate(${hoursDeg} 50 50)`" />
      <line x1="50" y1="50" x2="50" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"
        :transform="`rotate(${minutesDeg} 50 50)`" />
      <line x1="50" y1="56" x2="50" y2="14" stroke="currentColor" stroke-width="1" stroke-linecap="round"
        :transform="`rotate(${secondsDeg} 50 50)`" />
      <circle cx="50" cy="50" r="3" fill="currentColor" />
    </svg>
  </div>
</template>

<style scoped>
.clock-card {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clock-card__digital {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}

.clock-card__analog {
  height: 90%;
  max-height: 100%;
  aspect-ratio: 1;
}
</style>
