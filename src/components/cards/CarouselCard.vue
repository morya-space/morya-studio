<script setup lang="ts">
/**
 * 轮播卡（carousel）
 * 对齐 go-view ImageCarousel：多图定时切换。
 */

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CardProps } from './types'

const props = defineProps<CardProps>()

const cfg = computed(() => props.schema.carousel ?? {})
const urls = computed(() => (cfg.value.urls ?? []).filter(Boolean))

const index = ref(0)
let timer: number | undefined

function start() {
  stopTimer()
  const interval = Math.max(1, Number(cfg.value.interval ?? 3)) * 1000
  if (urls.value.length > 1 && typeof window !== 'undefined') {
    timer = window.setInterval(() => {
      index.value = (index.value + 1) % urls.value.length
    }, interval)
  }
}
function stopTimer() {
  if (timer) window.clearInterval(timer)
  timer = undefined
}

watch(urls, () => { index.value = 0; start() })
onMounted(start)
onBeforeUnmount(stopTimer)

const style = computed(() => ({ borderRadius: `${cfg.value.radius ?? 8}px` }))
</script>

<template>
  <div class="carousel-card">
    <img v-if="urls.length" class="carousel-card__img" :src="urls[index]" :style="style" alt="">
    <div v-else class="carousel-card__empty">未设置图片</div>
    <div v-if="urls.length > 1" class="carousel-card__dots">
      <span
        v-for="(_, i) in urls"
        :key="i"
        class="carousel-card__dot"
        :class="{ on: i === index }"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.carousel-card {
  position: relative;
  height: 100%;
  width: 100%;
  overflow: hidden;

  &__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &__empty {
    height: 100%;
    display: grid;
    place-items: center;
    border: 1.5px dashed var(--m-color-border);
    border-radius: var(--m-radius-md);
    color: var(--m-color-text-muted);
    font-size: 12px;
  }

  &__dots {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 8px;
    display: flex;
    justify-content: center;
    gap: 6px;
  }

  &__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--m-color-surface) 70%, transparent);

    &.on {
      background: var(--m-color-primary);
      width: 16px;
      border-radius: 3px;
    }
  }
}
</style>
