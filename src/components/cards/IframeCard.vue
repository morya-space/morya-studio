<script setup lang="ts">
/**
 * 内嵌网页卡（iframe）
 * 对齐 go-view Iframe；仅允许 http/https，sandbox 限制脚本能力。
 */

import { computed } from 'vue'
import type { CardProps } from './types'

const props = defineProps<CardProps>()

const cfg = computed(() => props.schema.iframe ?? {})

const safeUrl = computed(() => {
  const raw = (cfg.value.url ?? '').trim()
  if (!raw) return ''
  try {
    const u = new URL(raw)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : ''
  } catch {
    return ''
  }
})
</script>

<template>
  <div class="iframe-card">
    <iframe
      v-if="safeUrl"
      class="iframe-card__frame"
      :src="safeUrl"
      :title="cfg.title ?? '内嵌页面'"
      sandbox="allow-scripts allow-same-origin"
      loading="lazy"
      referrerpolicy="no-referrer"
    />
    <div v-else class="iframe-card__empty">未设置或非法的 URL</div>
  </div>
</template>

<style lang="scss" scoped>
.iframe-card {
  height: 100%;
  width: 100%;
  overflow: hidden;

  &__frame {
    width: 100%;
    height: 100%;
    border: 0;
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
}
</style>
