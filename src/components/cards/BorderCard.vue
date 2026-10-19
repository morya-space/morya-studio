<script setup lang="ts">
/**
 * 边框装饰卡（border）
 * 对齐 go-view Borders：边框样式变体，颜色走 token（可被 schema 覆盖）。
 */

import { computed } from 'vue'
import type { CardProps } from './types'

const props = defineProps<CardProps>()

const cfg = computed(() => props.schema.decorate ?? {})
const variant = computed(() => cfg.value.variant ?? 'border01')
const style = computed(() => ({
  '--deco-color': cfg.value.color ?? 'var(--m-color-primary)',
  '--deco-bg': cfg.value.background ?? 'transparent',
}))
</script>

<template>
  <div class="border-card" :class="`border-card--${variant}`" :style="style" />
</template>

<style scoped>
.border-card {
  position: relative;
  height: 100%;
  width: 100%;
  background: var(--deco-bg);
}

/* 四角点样式（01/02/03） */
.border-card--border01::before,
.border-card--border01::after {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  border: 2px solid var(--deco-color);
}
.border-card--border01::before { left: 0; top: 0; border-right: none; border-bottom: none; }
.border-card--border01::after { right: 0; bottom: 0; border-left: none; border-top: none; }

.border-card--border02 {
  border: 1px solid color-mix(in srgb, var(--deco-color) 45%, transparent);
}
.border-card--border02::before {
  content: '';
  position: absolute;
  left: -1px; top: -1px;
  width: 26px; height: 4px;
  background: var(--deco-color);
  box-shadow: 0 0 8px var(--deco-color);
}

.border-card--border03 {
  border-left: 3px solid var(--deco-color);
  background: linear-gradient(90deg, color-mix(in srgb, var(--deco-color) 14%, transparent), transparent 60%);
  padding-left: 12px;
}

.border-card--border04 {
  border: 1px dashed color-mix(in srgb, var(--deco-color) 55%, transparent);
  border-radius: var(--m-radius-md);
}

.border-card--border05::before,
.border-card--border05::after {
  content: '';
  position: absolute;
  left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--deco-color), transparent);
}
.border-card--border05::before { top: 0; }
.border-card--border05::after { bottom: 0; }

.border-card--border06 {
  border: 1px solid color-mix(in srgb, var(--deco-color) 40%, transparent);
  border-radius: var(--m-radius-sm);
  box-shadow: inset 0 0 20px color-mix(in srgb, var(--deco-color) 12%, transparent);
}

.border-card--border07::before,
.border-card--border07::after {
  content: '';
  position: absolute;
  width: 22px;
  height: 22px;
  border: 2px solid var(--deco-color);
}
.border-card--border07::before { right: 0; top: 0; border-left: none; border-bottom: none; }
.border-card--border07::after { left: 0; bottom: 0; border-right: none; border-top: none; }

.border-card--border08 {
  border-top: 3px solid var(--deco-color);
  background: linear-gradient(180deg, color-mix(in srgb, var(--deco-color) 12%, transparent), transparent 40%);
}

.border-card--border09 {
  border: 3px double color-mix(in srgb, var(--deco-color) 70%, transparent);
}

.border-card--border10 {
  border: 1px solid color-mix(in srgb, var(--deco-color) 45%, transparent);
  border-radius: var(--m-radius-md);
}
.border-card--border10::before,
.border-card--border10::after {
  content: '';
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--deco-color);
}
.border-card--border10::before { left: -3px; top: -3px; }
.border-card--border10::after { right: -3px; bottom: -3px; }

.border-card--border11::before,
.border-card--border11::after {
  content: '';
  position: absolute;
  top: 8%;
  bottom: 8%;
  width: 3px;
  background: var(--deco-color);
  border-radius: 2px;
}
.border-card--border11::before { left: 0; }
.border-card--border11::after { right: 0; }

.border-card--border12 {
  border: 1px solid var(--deco-color);
  box-shadow: 0 0 12px color-mix(in srgb, var(--deco-color) 55%, transparent),
    inset 0 0 12px color-mix(in srgb, var(--deco-color) 30%, transparent);
}

.border-card--border13::before,
.border-card--border13::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 2px solid transparent;
}
.border-card--border13::before {
  border-top-color: var(--deco-color);
  border-bottom-color: var(--deco-color);
  clip-path: polygon(0 0, 30% 0, 30% 100%, 0 100%, 0 0, 70% 0, 100% 0, 100% 100%, 70% 100%, 70% 0);
}
.border-card--border13::after {
  border-left-color: var(--deco-color);
  border-right-color: var(--deco-color);
  clip-path: polygon(0 0, 100% 0, 100% 30%, 0 30%, 0 0, 0 70%, 0 100%, 100% 100%, 100% 70%, 0 70%);
}
</style>
