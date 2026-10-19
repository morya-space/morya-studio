<script setup lang="ts">
/**
 * 水球卡（waterPolo）
 * 对齐 go-view WaterPolo：水位 + 波浪动画 + 百分比。
 */

import { computed } from 'vue'
import type { CardProps } from './types'

const props = defineProps<CardProps>()

const cfg = computed(() => props.schema.waterPolo ?? {})

const value = computed(() => {
  const c = cfg.value
  if (c.valueField && props.data[0]) return Number(props.data[0][c.valueField] ?? 0)
  return Number(c.value ?? 0)
})
const max = computed(() => Math.max(1, Number(cfg.value.max ?? 100)))
const ratio = computed(() => Math.max(0, Math.min(1, value.value / max.value)))
const percent = computed(() => `${(ratio.value * 100).toFixed(cfg.value.precision ?? 0)}%`)

/** 水位从底部升起：fill 高度 = ratio */
const fillStyle = computed(() => ({ height: `${ratio.value * 100}%` }))
const color = computed(() => cfg.value.color ?? 'var(--m-color-primary)')
</script>

<template>
  <div class="water-polo-card">
    <div class="water-polo-card__ball" :style="{ color }">
      <div class="water-polo-card__fill" :style="fillStyle">
        <svg class="water-polo-card__wave" viewBox="0 0 200 20" preserveAspectRatio="none">
          <path d="M0 10 Q25 0 50 10 T100 10 T150 10 T200 10 V20 H0 Z" fill="currentColor" opacity="0.85" />
        </svg>
        <span class="water-polo-card__wave water-polo-card__wave--slow" />
      </div>
      <span class="water-polo-card__text">{{ percent }}</span>
    </div>
  </div>
</template>

<style scoped>
.water-polo-card {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.water-polo-card__ball {
  position: relative;
  height: 90%;
  aspect-ratio: 1;
  max-height: 100%;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid color-mix(in srgb, currentColor 55%, transparent);
  background: color-mix(in srgb, currentColor 10%, transparent);
}

.water-polo-card__fill {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: color-mix(in srgb, currentColor 45%, transparent);
  transition: height 0.6s ease;
}

.water-polo-card__wave {
  position: absolute;
  left: 0;
  top: -9px;
  width: 200%;
  height: 18px;
  color: currentColor;
  animation: water-wave 3s linear infinite;
}

.water-polo-card__wave--slow {
  top: -6px;
  opacity: 0.5;
  animation-duration: 5s;
  animation-direction: reverse;
}

.water-polo-card__text {
  position: relative;
  z-index: 2;
  display: grid;
  place-items: center;
  height: 100%;
  font-size: 22px;
  font-weight: 700;
  color: var(--m-color-text);
  font-variant-numeric: tabular-nums;
}

@keyframes water-wave {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

@media (prefers-reduced-motion: reduce) {
  .water-polo-card__wave { animation: none; }
}
</style>
