<script setup lang="ts">
/**
 * 全屏按钮卡（fullScreen）
 * 对齐 go-view FullScreen：点击切换浏览器全屏。
 */

import { computed, ref } from 'vue'
import { MButton } from 'morya-ui'
import type { CardProps } from './types'

const props = defineProps<CardProps>()

const cfg = computed(() => props.schema.fullScreen ?? {})
const isFull = ref(false)

function toggle() {
  const el = document.documentElement
  if (!document.fullscreenElement) {
    void el.requestFullscreen?.()
    isFull.value = true
  } else {
    void document.exitFullscreen?.()
    isFull.value = false
  }
}
</script>

<template>
  <div class="fullscreen-card">
    <MButton
      type="default"
      block
      :style="cfg.color ? { color: cfg.color, borderColor: cfg.color } : {}"
      @click="toggle"
    >
      {{ cfg.text ?? (isFull ? '退出全屏' : '全屏') }}
    </MButton>
  </div>
</template>

<style scoped>
.fullscreen-card {
  height: 100%;
  display: flex;
  align-items: center;
}
</style>
