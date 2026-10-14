<script setup lang="ts">
import { MIcon } from 'morya-ui'
import type { MSizeInput } from 'morya-ui'

withDefaults(defineProps<{
  name: string
  size?: MSizeInput
  /** 自定义像素尺寸，覆盖 size 属性 */
  px?: number
}>(), {
  size: 'md',
})
</script>

<template>
  <MIcon :size="size" :style="px ? { width: `${px}px`, height: `${px}px`, fontSize: `${px}px` } : undefined">
    <svg class="svg-icon" aria-hidden="true">
      <use :href="`#icon-${name}`" />
    </svg>
  </MIcon>
</template>

<style scoped>
.svg-icon {
  width: 1em;
  height: 1em;
  fill: none;
  stroke: currentColor;
  vertical-align: -0.15em;
  overflow: hidden;
}
</style>
