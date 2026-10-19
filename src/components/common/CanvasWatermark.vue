<script setup lang="ts">
/**
 * 画布水印（对齐 go-view 画布水印）
 * 斜向重复文字，低透明度，覆盖整个画布。
 */

import { computed } from 'vue'

const props = defineProps<{ text?: string }>()

const items = computed(() => Array.from({ length: 24 }))

const label = computed(() => (props.text ?? 'Morya').trim() || 'Morya')
</script>

<template>
  <div class="watermark" aria-hidden="true">
    <span v-for="(_, i) in items" :key="i" class="watermark__item">{{ label }}</span>
  </div>
</template>

<style scoped>
.watermark {
  position: absolute;
  inset: 0;
  z-index: 900;
  pointer-events: none;
  overflow: hidden;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: 1fr;
  align-items: center;
  justify-items: center;
}

.watermark__item {
  transform: rotate(-22deg);
  font-size: 14px;
  font-weight: 600;
  color: var(--m-color-text-muted);
  opacity: 0.12;
  white-space: nowrap;
  user-select: none;
}
</style>
