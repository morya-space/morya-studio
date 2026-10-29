<script setup lang="ts">
/**
 * 分页卡（pagination）
 * 对齐 go-view InputsPagination：大屏分页控件。
 */

import { computed, ref, watch } from 'vue'
import { MButton } from 'morya-ui'
import type { CardProps } from './types'

const props = defineProps<CardProps>()

const cfg = computed(() => props.schema.pagination ?? {})
const pageSize = computed(() => Math.max(1, Number(cfg.value.pageSize ?? 10)))
const total = computed(() => Math.max(0, Number(cfg.value.total ?? 0)))
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const page = ref(1)

watch(totalPages, tp => { if (page.value > tp) page.value = tp })
</script>

<template>
  <div class="pagination-card">
    <MButton type="default" size="small" :disabled="page <= 1" @click="page--">上一页</MButton>
    <span class="pagination-card__info">{{ page }} / {{ totalPages }}</span>
    <MButton type="default" size="small" :disabled="page >= totalPages" @click="page++">下一页</MButton>
  </div>
</template>

<style lang="scss" scoped>
.pagination-card {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;

  &__info {
    font-size: 13px;
    color: var(--m-color-text-muted);
    font-variant-numeric: tabular-nums;
  }
}
</style>
