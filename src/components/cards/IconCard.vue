<script setup lang="ts">
/**
 * 图标卡（icon）
 * 对齐 go-view Icon：内置 SVG 图标 + 尺寸/颜色。
 */

import { computed } from 'vue'
import SvgIcon from '../common/SvgIcon.vue'
import type { CardProps } from './types'

const props = defineProps<CardProps>()

const cfg = computed(() => props.schema.icon ?? {})
</script>

<template>
  <div class="icon-card" :style="{ color: cfg.color ?? 'var(--m-color-primary)' }">
    <SvgIcon :name="cfg.name ?? 'star'" :px="cfg.size ?? 32" />
  </div>
</template>

<style lang="scss" scoped>
.icon-card {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
