/**
 * useECharts（v0.2 增强）
 * - 注册更多图表类型（area/radar/scatter/funnel/gauge）
 * - 配色读 --m-chart-* token（不再写死 hex）
 * - 支持 stack / seriesField 多系列 / rawOption 逃生舱
 * 图表细节规范：docs/DESIGN-DEV.md §12.6
 */

import * as echarts from 'echarts/core'
import {
  BarChart,
  LineChart,
  PieChart,
  RadarChart,
  ScatterChart,
  FunnelChart,
  GaugeChart,
} from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { onBeforeUnmount, onMounted, ref, shallowRef, watch, computed, toValue, type Ref, type MaybeRef } from 'vue'
import type { ChartConfig } from '../types/schema'
import { getChartPalette, getToken } from './useThemeToken'

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  RadarChart,
  ScatterChart,
  FunnelChart,
  GaugeChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
])

export interface UseEChartsReturn {
  containerRef: Ref<HTMLElement | null>
  chart: Ref<echarts.ECharts | null>
  resize: () => void
  setOption: (option: echarts.EChartsCoreOption) => void
}

type Row = Record<string, unknown>

/** 深度合并（用于 rawOption 补丁，数组直接覆盖） */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...target }
  for (const [k, v] of Object.entries(source)) {
    const tv = out[k]
    if (v !== null && typeof v === 'object' && !Array.isArray(v)
      && tv !== null && typeof tv === 'object' && !Array.isArray(tv)) {
      out[k] = deepMerge(tv as Record<string, unknown>, v as Record<string, unknown>)
    } else {
      out[k] = v
    }
  }
  return out
}

export function useECharts(configInput: MaybeRef<ChartConfig>, data: Ref<Row[]>): UseEChartsReturn {
  const containerRef = ref<HTMLElement | null>(null)
  const chart = shallowRef<echarts.ECharts | null>(null)
  /** 配置（响应式）：ChartCard 传入 computed 时，配置变动会实时重建图表 */
  const config = computed(() => toValue(configInput))
  /** setOption 手动覆盖的最近一次 option，重建图表后需要重放（否则自定义样式丢失） */
  let lastManualOption: echarts.EChartsCoreOption | null = null
  let resizeObserver: ResizeObserver | null = null

  const palette = (): string[] => config.value.colors ?? getChartPalette()
  const axisColor = () => getToken('--m-chart-axis')
  const splitColor = () => getToken('--m-chart-split')
  const surfaceColor = () => getToken('--m-chart-surface')
  const textColor = () => getToken('--m-chart-text')

  /** 按 seriesField 把数据拆成多系列 */
  function groupBySeries(items: Row[]): Map<string, Row[]> {
    const field = config.value.seriesField
    if (!field) return new Map([['', items]])
    const groups = new Map<string, Row[]>()
    for (const row of items) {
      const key = String(row[field] ?? '')
      const bucket = groups.get(key)
      if (bucket) bucket.push(row)
      else groups.set(key, [row])
    }
    return groups
  }

  function baseCartesian(xData: string[]): echarts.EChartsCoreOption {
    const c = config.value
    return {
      grid: { show: false, left: 0, right: 0, top: 10, bottom: 0, containLabel: true },
      tooltip: { show: c.showTooltip !== false, trigger: 'axis' },
      legend: { show: c.showLegend ?? false },
      xAxis: {
        type: 'category',
        data: xData,
        show: c.showGrid !== false,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: axisColor(), fontSize: 12 },
      },
      yAxis: {
        type: 'value',
        show: c.showGrid !== false,
        name: c.yAxis?.title ?? '',
        splitLine: { lineStyle: { color: splitColor() } },
        axisLabel: { color: axisColor(), fontSize: 12 },
      },
    }
  }

  function buildOption(): echarts.EChartsCoreOption {
    const c = config.value
    const items = data.value
    const xField = c.xField ?? 'x'
    const yField = c.yField ?? 'y'
    const xData = items.map(item => String(item[xField] ?? ''))
    const groups = groupBySeries(items)
    const seriesNames = [...groups.keys()]
    const multi = c.seriesField ? seriesNames.length : 1
    const stackName = c.stack ? 'total' : undefined

    let option: echarts.EChartsCoreOption

    switch (c.chartType) {
      case 'bar': {
        option = {
          ...baseCartesian(xData),
          color: palette(),
          series: seriesNames.map(name => ({
            name: name || undefined,
            type: 'bar',
            stack: stackName,
            data: (groups.get(name) ?? []).map(item => Number(item[yField] ?? 0)),
            barWidth: multi > 1 ? undefined : '60%',
            itemStyle: { borderRadius: [4, 4, 0, 0] },
          })),
        }
        break
      }

      case 'line':
      case 'area': {
        const isArea = c.chartType === 'area'
        option = {
          ...baseCartesian(xData),
          color: palette(),
          series: seriesNames.map(name => ({
            name: name || undefined,
            type: 'line',
            stack: stackName,
            data: (groups.get(name) ?? []).map(item => Number(item[yField] ?? 0)),
            smooth: c.smooth ?? true,
            lineStyle: { width: 3 },
            areaStyle: isArea ? { opacity: 0.15 } : undefined,
          })),
        }
        break
      }

      case 'pie': {
        option = {
          color: palette(),
          tooltip: { trigger: 'item' },
          legend: { show: c.showLegend ?? false },
          series: [{
            type: 'pie',
            radius: ['40%', '70%'],
            data: items.map(item => ({
              name: String(item[xField] ?? ''),
              value: Number(item[yField] ?? 0),
            })),
            label: { show: false },
            itemStyle: { borderRadius: 6, borderWidth: 2, borderColor: surfaceColor() },
          }],
        }
        break
      }

      case 'radar': {
        option = {
          color: palette(),
          tooltip: { show: c.showTooltip !== false },
          legend: { show: c.showLegend ?? false },
          radar: {
            indicator: items.map(item => ({ name: String(item[xField] ?? '') })),
            axisName: { color: axisColor(), fontSize: 12 },
          },
          series: [{
            type: 'radar',
            data: [{
              value: items.map(item => Number(item[yField] ?? 0)),
              name: c.yAxis?.title ?? '',
            }],
          }],
        }
        break
      }

      case 'scatter': {
        option = {
          ...baseCartesian(xData),
          color: palette(),
          series: seriesNames.map(name => ({
            name: name || undefined,
            type: 'scatter',
            data: (groups.get(name) ?? []).map(item => Number(item[yField] ?? 0)),
            symbolSize: 12,
          })),
        }
        break
      }

      case 'funnel': {
        option = {
          color: palette(),
          tooltip: { trigger: 'item' },
          series: [{
            type: 'funnel',
            left: '10%',
            width: '80%',
            data: items.map(item => ({
              name: String(item[xField] ?? ''),
              value: Number(item[yField] ?? 0),
            })),
            label: { color: axisColor() },
          }],
        }
        break
      }

      case 'gauge': {
        const first = items[0]
        const value = first ? Number(first[yField] ?? 0) : 0
        option = {
          series: [{
            type: 'gauge',
            startAngle: 210,
            endAngle: -30,
            min: 0,
            max: 100,
            progress: { show: true, width: 10, roundCap: true, itemStyle: { color: palette()[0] } },
            axisLine: { lineStyle: { width: 10, color: [[1, splitColor()]] } },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: false },
            pointer: { show: false },
            title: { show: false },
            detail: { valueAnimation: true, fontSize: 24, color: textColor(), formatter: '{value}' },
            data: [{ value }],
          }],
        }
        break
      }

      default: {
        option = baseCartesian(xData)
      }
    }

    // rawOption 逃生舱：深度合并到最后
    if (c.rawOption) {
      option = deepMerge(option as Record<string, unknown>, c.rawOption) as echarts.EChartsCoreOption
    }

    return option
  }

  const initChart = () => {
    if (!containerRef.value) return
    // 同一容器已有实例则跳过（setTimeout 补刀与 watcher 可能并发触发）
    if (chart.value && chart.value.getDom() === containerRef.value) return
    const rect = containerRef.value.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      console.warn('ECharts container has zero size', rect)
      return
    }
    chart.value = echarts.init(containerRef.value)
    chart.value.setOption(buildOption())
    if (lastManualOption) chart.value.setOption(lastManualOption)
  }

  const resize = () => chart.value?.resize()
  const setOption = (option: echarts.EChartsCoreOption) => {
    lastManualOption = option
    chart.value?.setOption(option)
  }

  onMounted(() => {
    setTimeout(initChart, 100)
    window.addEventListener('resize', resize)
  })

  function attachResizeObserver(el: HTMLElement) {
    if (typeof ResizeObserver === 'undefined' || resizeObserver) return
    resizeObserver = new ResizeObserver(() => chart.value?.resize())
    resizeObserver.observe(el)
  }

  // 容器可能晚于挂载才渲染（如异步数据就绪后），出现时补初始化。
  // 元素被 v-if 卸载时（如切走 Tab）chart 实例仍挂在旧 DOM 上，需 dispose，
  // 待元素重新挂载（切回 Tab）后在新容器上重建。
  // 容器尺寸变化（卡片边框拖拽 / 网格列宽等）实时重绘。
  watch(containerRef, (el) => {
    if (!el) {
      resizeObserver?.disconnect()
      resizeObserver = null
      chart.value?.dispose()
      chart.value = null
      return
    }
    attachResizeObserver(el)
    if (!chart.value) initChart()
  }, { flush: 'post' })

  onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    resizeObserver = null
    window.removeEventListener('resize', resize)
    chart.value?.dispose()
  })

  // 配置（维度 / 指标等字段）或数据变化 → 实时重建 option
  watch([config, data], () => {
    chart.value?.setOption(buildOption())
  }, { deep: true })

  return { containerRef, chart, resize, setOption }
}
