<script setup lang="ts">
/**
 * 图表卡（chart）
 * 用 useECharts 渲染 schema.chart 配置的图表。
 * - 配置（维度/指标等字段、图表类型）变化实时重绘
 * - 图表高度自适应卡片（自由布局拖拽边框实时重绘）
 */

import { computed, toRef } from 'vue'
import CardShell from './CardShell.vue'
import { useECharts } from '../../composables/useECharts'
import type { CardProps, CardEmits } from './types'

const props = defineProps<CardProps>()
const emit = defineEmits<CardEmits>()

const chartConfig = computed(() => props.schema.chart ?? { chartType: 'bar' as const })
const { containerRef } = useECharts(chartConfig, toRef(props, 'data'))
void containerRef // template ref usage

const minHeight = computed(() =>
  props.schema.chart?.height ?? props.schema.height ?? 240,
)
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
    <div ref="containerRef" class="chart-card" :style="{ minHeight: `${minHeight}px` }" />
  </CardShell>
</template>

<style scoped>
.chart-card {
  width: 100%;
  height: 100%;
}
</style>
