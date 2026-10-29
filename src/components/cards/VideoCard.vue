<script setup lang="ts">
/**
 * 视频卡（video）
 * 对齐 go-view Video。仅允许 http/https / 相对地址。
 */

import { computed } from 'vue'
import type { CardProps } from './types'

const props = defineProps<CardProps>()

const cfg = computed(() => props.schema.video ?? {})

const safeUrl = computed(() => {
  const raw = (cfg.value.url ?? '').trim()
  if (!raw) return ''
  if (raw.startsWith('/') || raw.startsWith('data:') || raw.startsWith('blob:')) return raw
  try {
    const u = new URL(raw)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : ''
  } catch {
    return ''
  }
})

const style = computed(() => ({ objectFit: cfg.value.fit ?? 'contain' }))
</script>

<template>
  <div class="video-card">
    <video
      v-if="safeUrl"
      class="video-card__el"
      :src="safeUrl"
      :style="style"
      :muted="cfg.muted ?? true"
      :loop="cfg.loop ?? true"
      :autoplay="cfg.autoplay ?? true"
      :controls="cfg.controls ?? false"
      playsinline
    />
    <div v-else class="video-card__empty">未设置或非法的视频地址</div>
  </div>
</template>

<style lang="scss" scoped>
.video-card {
  height: 100%;
  width: 100%;
  overflow: hidden;

  &__el {
    width: 100%;
    height: 100%;
    display: block;
    background: var(--m-color-text);
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
}
</style>
