<script setup lang="ts">
/**
 * 倒计时卡（countdown）
 * 对齐 go-view CountDown：目标时间倒计时。
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

const cfg = computed(() => props.schema.countdown ?? {})

const text = computed(() => {
  const target = cfg.value.target ? new Date(cfg.value.target).getTime() : 0
  if (!target || Number.isNaN(target)) return '--'
  let diff = Math.max(0, target - now.value)
  const day = Math.floor(diff / 86400000); diff -= day * 86400000
  const hh = Math.floor(diff / 3600000); diff -= hh * 3600000
  const mm = Math.floor(diff / 60000); diff -= mm * 60000
  const ss = Math.floor(diff / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = cfg.value.format ?? 'DD 天 HH:mm:ss'
  return fmt
    .replace('DD', String(day))
    .replace('HH', pad(hh))
    .replace('mm', pad(mm))
    .replace('ss', pad(ss))
})

const style = computed(() => ({
  fontSize: `${cfg.value.fontSize ?? 26}px`,
  color: cfg.value.color ?? 'var(--m-color-primary)',
}))
</script>

<template>
  <div class="countdown-card">
    <span class="countdown-card__value" :style="style">{{ text }}</span>
  </div>
</template>

<style lang="scss" scoped>
.countdown-card {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  &__value {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.04em;
  }
}
</style>
