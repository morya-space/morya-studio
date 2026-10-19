<script setup lang="ts">
/**
 * 图表卡（chart）
 * 用 useECharts 渲染 schema.chart；容器铺满卡片并随尺寸/配置实时重绘。
 */

import { computed, toRef } from 'vue'
import CardShell from './CardShell.vue'
import { useECharts } from '../../composables/useECharts'
import type { ChartConfig } from '../../types/schema'
import type { CardProps, CardEmits } from './types'

const props = defineProps<CardProps>()
const emit = defineEmits<CardEmits>()

const chartConfig = computed<ChartConfig>(() => props.schema.chart ?? { chartType: 'bar' })
const { containerRef } = useECharts(chartConfig, toRef(props, 'data'))
void containerRef

/** 固定高度时（如网格布局显式 height）适配为 px，否则铺满卡片（随卡片高度自适应） */
const style = computed(() => {
  const h = props.schema.chart?.height ?? props.schema.height
  return h ? { height: `${h}px` } : { height: '100%' }
})
</script>

<template>
  <CardShell
    :title="schema.title"
    :subtitle="schema.subtitle"
    :loading="loading"
    :error="error"
    :empty="data.length === 0"
    :state-text="schema.stateText"
    :actions="schema.actions"
    @retry="emit('retry')"
    @action="emit('action', $event)"
  >
    <div ref="containerRef" class="chart-card" :style="style" />
  </CardShell>
</template>

<style scoped>
.chart-card {
  width: 100%;
}
</style>
