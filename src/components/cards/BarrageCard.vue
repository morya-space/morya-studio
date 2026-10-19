<script setup lang="ts">
/**
 * 跑马灯文字卡（barrage）
 * 对齐 go-view TextBarrage：横向滚动文字。纯 CSS 动画，速度可调。
 */

import { computed } from 'vue'
import type { CardProps } from './types'

const props = defineProps<CardProps>()

const cfg = computed(() => props.schema.barrage ?? {})
const text = computed(() => cfg.value.text ?? '')

const style = computed(() => {
  const speed = Math.max(10, Number(cfg.value.speed ?? 80))
  return {
    fontSize: `${cfg.value.fontSize ?? 16}px`,
    color: cfg.value.color ?? 'var(--m-color-text)',
    animationDuration: `${Math.max(3, 400 / speed)}s`,
  }
})
</script>

<template>
  <div class="barrage-card">
    <span v-if="text" class="barrage-card__track" :style="style">{{ text }}</span>
  </div>
</template>

<style scoped>
.barrage-card {
  height: 100%;
  display: flex;
  align-items: center;
  overflow: hidden;
  white-space: nowrap;
}

.barrage-card__track {
  display: inline-block;
  padding-left: 100%;
  will-change: transform;
  animation-name: barrage-move;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

@keyframes barrage-move {
  from { transform: translateX(0); }
  to { transform: translateX(-100%); }
}

@media (prefers-reduced-motion: reduce) {
  .barrage-card__track { animation: none; padding-left: 0; }
}
</style>
