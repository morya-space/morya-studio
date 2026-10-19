<script setup lang="ts">
/**
 * 装饰线条 / 标题框卡（decoration）
 * 对齐 go-view Decorates：横线 / 竖线 / 标题条 / 取景框。
 */

import { computed } from 'vue'
import type { CardProps } from './types'

const props = defineProps<CardProps>()

const cfg = computed(() => props.schema.decorate ?? {})
const variant = computed(() => cfg.value.variant ?? 'title')
const style = computed(() => ({
  '--deco-color': cfg.value.color ?? 'var(--m-color-primary)',
}))
</script>

<template>
  <div class="decoration" :class="`decoration--${variant}`" :style="style">
    <template v-if="variant === 'title'">
      <span class="decoration__bar" />
      <span class="decoration__text">{{ cfg.title ?? '标题' }}</span>
      <span class="decoration__line" />
    </template>
  </div>
</template>

<style scoped>
.decoration {
  position: relative;
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
}

.decoration--line-h::before {
  content: '';
  width: 100%;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--deco-color), transparent);
}

.decoration--line-v {
  justify-content: center;
}
.decoration--line-v::before {
  content: '';
  width: 2px;
  height: 100%;
  background: linear-gradient(180deg, transparent, var(--deco-color), transparent);
}

.decoration--box {
  border: 1px solid color-mix(in srgb, var(--deco-color) 50%, transparent);
  border-radius: var(--m-radius-sm);
}

.decoration--corner::before,
.decoration--corner::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  border: 2px solid var(--deco-color);
}
.decoration--corner::before { left: 0; top: 0; border-right: none; border-bottom: none; }
.decoration--corner::after { right: 0; bottom: 0; border-left: none; border-top: none; }

.decoration--line-dual {
  justify-content: center;
}
.decoration--line-dual::before {
  content: '';
  width: 100%;
  height: 6px;
  background:
    linear-gradient(90deg, transparent, var(--deco-color), transparent) top / 100% 1px no-repeat,
    linear-gradient(90deg, transparent, var(--deco-color), transparent) bottom / 100% 1px no-repeat;
}

.decoration--circle {
  justify-content: center;
}
.decoration--circle::before {
  content: '';
  width: 60%;
  height: 60%;
  border-radius: 50%;
  border: 2px dashed var(--deco-color);
  animation: deco-spin 8s linear infinite;
}

.decoration--pipeline-h::before {
  content: '';
  width: 100%;
  height: 2px;
  background: var(--deco-color);
  border-radius: 2px;
  box-shadow: 0 0 8px var(--deco-color);
}
.decoration--pipeline-h::after {
  content: '';
  position: absolute;
  right: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--deco-color);
  box-shadow: 0 0 10px var(--deco-color);
}

.decoration--pipeline-v {
  justify-content: center;
}
.decoration--pipeline-v::before {
  content: '';
  width: 2px;
  height: 100%;
  background: var(--deco-color);
  box-shadow: 0 0 8px var(--deco-color);
}

.decoration--flow::before {
  content: '';
  width: 100%;
  height: 2px;
  background-image: repeating-linear-gradient(90deg, var(--deco-color) 0 10px, transparent 10px 20px);
  background-size: 20px 2px;
  animation: deco-flow 1.2s linear infinite;
}

@keyframes deco-spin {
  to { transform: rotate(360deg); }
}
@keyframes deco-flow {
  to { background-position: 20px 0; }
}

.decoration--title {
  gap: 8px;
}
.decoration__bar {
  width: 4px;
  height: 60%;
  border-radius: 2px;
  background: var(--deco-color);
}
.decoration__text {
  font-size: 15px;
  font-weight: 700;
  color: var(--m-color-text);
  white-space: nowrap;
}
.decoration__line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--deco-color) 60%, transparent), transparent);
}
</style>
