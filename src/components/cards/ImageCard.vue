<script setup lang="ts">
/**
 * 图片卡（image）
 * 对齐 go-view Image：URL + 适应方式 + 圆角。
 */

import { computed } from 'vue'
import SvgIcon from '../common/SvgIcon.vue'
import type { CardProps } from './types'

const props = defineProps<CardProps>()

const cfg = computed(() => props.schema.image ?? {})
const url = computed(() => cfg.value.url ?? '')
const style = computed(() => ({
  objectFit: cfg.value.fit ?? 'contain',
  borderRadius: `${cfg.value.radius ?? 8}px`,
}))
</script>

<template>
  <div class="image-card">
    <img v-if="url" class="image-card__img" :src="url" :style="style" alt="">
    <div v-else class="image-card__empty">
      <SvgIcon name="box" :px="28" />
      <span>未设置图片</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.image-card {
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  &__img {
    width: 100%;
    height: 100%;
    display: block;
  }

  &__empty {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 1.5px dashed var(--m-color-border);
    border-radius: var(--m-radius-md);
    color: var(--m-color-text-muted);
    font-size: 12px;
  }
}
</style>
