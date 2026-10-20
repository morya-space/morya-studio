/**
 * useECharts（v0.4 增强）
 * - 注册图表类型（含 sankey/graph/heatmap/treemap）
 * - 配色读 --m-chart-* token
 * - config 为响应式：配置变更实时重绘
 * - 容器 ResizeObserver：拖拽/缩放后自适应重绘
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
  SankeyChart,
  GraphChart,
  HeatmapChart,
  TreemapChart,
} from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref } from 'vue'
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
  SankeyChart,
  GraphChart,
  HeatmapChart,
  TreemapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
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

export function useECharts(config: Ref<ChartConfig>, data: Ref<Row[]>): UseEChartsReturn {
  const containerRef = ref<HTMLElement | null>(null)
  const chart = shallowRef<echarts.ECharts | null>(null)
  let ro: ResizeObserver | null = null
  /** setOption 手动覆盖的最近一次 option，重建图表后需要重放 */
  let lastManualOption: echarts.EChartsCoreOption | null = null

  const cfg = () => config.value
  const palette = (): string[] => cfg().colors ?? getChartPalette()
  const axisColor = () => getToken('--m-chart-axis')
  const splitColor = () => getToken('--m-chart-split')
  const surfaceColor = () => getToken('--m-chart-surface')
  const textColor = () => getToken('--m-chart-text')

  /** 标准化 yField 为数组（支持多度量） */
  function yFields(): string[] {
    const f = cfg().yField ?? 'y'
    return Array.isArray(f) ? (f.length > 0 ? f : ['y']) : [f]
  }

  /** 按 seriesField 把数据拆成多系列 */
  function groupBySeries(items: Row[]): Map<string, Row[]> {
    const field = cfg().seriesField
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
    return {
      grid: { show: false, left: 0, right: 0, top: 10, bottom: 0, containLabel: true },
      tooltip: { show: cfg().showTooltip !== false, trigger: 'axis' },
      legend: { show: cfg().showLegend ?? false },
      xAxis: {
        type: 'category',
        data: xData,
        show: cfg().showGrid !== false,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: axisColor(), fontSize: 12 },
      },
      yAxis: {
        type: 'value',
        show: cfg().showGrid !== false,
        name: cfg().yAxis?.title ?? '',
        splitLine: { lineStyle: { color: splitColor() } },
        axisLabel: { color: axisColor(), fontSize: 12 },
      },
    }
  }

  /** 生成系列数据：多 y 字段优先，否则按 seriesField 分组 */
  function buildSeries(items: Row[]): { name: string; data: number[] }[] {
    const yfs = yFields()
    // 多度量：每个 y 字段一个系列
    if (yfs.length > 1) {
      return yfs.map(field => ({
        name: field,
        data: items.map(item => Number(item[field] ?? 0)),
      }))
    }
    // 单度量 + 系列字段：按 seriesField 分组
    const yField = yfs[0]
    const groups = groupBySeries(items)
    const names = [...groups.keys()]
    return names.map(name => ({
      name: name || undefined as unknown as string,
      data: (groups.get(name) ?? []).map(item => Number(item[yField] ?? 0)),
    }))
  }

  function buildOption(): echarts.EChartsCoreOption {
    const c = cfg()
    const items = data.value
    const xField = c.xField ?? 'x'
    const yField = yFields()[0]
    const xData = items.map(item => String(item[xField] ?? ''))
    const stackName = c.stack ? 'total' : undefined

    let option: echarts.EChartsCoreOption

    switch (c.chartType) {
      case 'bar': {
        const seriesEntries = buildSeries(items)
        option = {
          ...baseCartesian(xData),
          color: palette(),
          series: seriesEntries.map(s => ({
            name: s.name || undefined,
            type: 'bar',
            stack: stackName,
            data: s.data,
            barWidth: seriesEntries.length > 1 ? undefined : '60%',
            itemStyle: { borderRadius: [4, 4, 0, 0] },
          })),
        }
        break
      }

      case 'barH': {
        const seriesEntries = buildSeries(items)
        option = {
          grid: { show: false, left: 0, right: 10, top: 10, bottom: 0, containLabel: true },
          tooltip: { show: c.showTooltip !== false, trigger: 'axis', axisPointer: { type: 'shadow' } },
          legend: { show: c.showLegend ?? false },
          color: palette(),
          xAxis: { type: 'value', axisLabel: { color: axisColor(), fontSize: 12 }, splitLine: { lineStyle: { color: splitColor() } } },
          yAxis: {
            type: 'category',
            data: xData,
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: axisColor(), fontSize: 12 },
          },
          series: seriesEntries.map(s => ({
            name: s.name || undefined,
            type: 'bar',
            stack: stackName,
            data: s.data,
            itemStyle: { borderRadius: [0, 4, 4, 0] },
          })),
        }
        break
      }

      case 'barLine': {
        const sub = c.subField
        const seriesEntries = buildSeries(items)
        option = {
          ...baseCartesian(xData),
          color: palette(),
          series: [
            ...seriesEntries.map(s => ({
              name: s.name || undefined,
              type: 'bar',
              data: s.data,
              barWidth: '40%',
              itemStyle: { borderRadius: [4, 4, 0, 0] },
            })),
            ...(sub
              ? [{
                  name: sub,
                  type: 'line',
                  smooth: c.smooth ?? true,
                  data: items.map(item => Number(item[sub] ?? 0)),
                  lineStyle: { width: 3 },
                }]
              : []),
          ],
        }
        break
      }

      case 'line':
      case 'area': {
        const isArea = c.chartType === 'area'
        const seriesEntries = buildSeries(items)
        option = {
          ...baseCartesian(xData),
          color: palette(),
          series: seriesEntries.map(s => ({
            name: s.name || undefined,
            type: 'line',
            stack: stackName,
            data: s.data,
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
            radius: c.donut === false ? ['0%', '70%'] : ['45%', '70%'],
            data: items.map(item => ({
              name: String(item[xField] ?? ''),
              value: Number(item[yField] ?? 0),
            })),
            label: { show: c.labelShow ?? false, color: textColor() },
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
        const seriesEntries = buildSeries(items)
        option = {
          ...baseCartesian(xData),
          color: palette(),
          series: seriesEntries.map(s => ({
            name: s.name || undefined,
            type: 'scatter',
            data: s.data,
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
            max: c.max ?? 100,
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

      case 'sankey': {
        const sf = c.seriesField ?? 'target'
        const names = [...new Set(items.flatMap(item => [String(item[xField] ?? ''), String(item[sf] ?? '')]))]
        option = {
          color: palette(),
          tooltip: { trigger: 'item' },
          series: [{
            type: 'sankey',
            data: names.map(name => ({ name })),
            links: items.map(item => ({
              source: String(item[xField] ?? ''),
              target: String(item[sf] ?? ''),
              value: Number(item[yField] ?? 0),
            })),
            emphasis: { focus: 'adjacency' },
            label: { color: textColor() },
            lineStyle: { color: 'gradient', opacity: 0.4 },
          }],
        }
        break
      }

      case 'graph': {
        const sf = c.seriesField ?? 'target'
        const names = [...new Set(items.flatMap(item => [String(item[xField] ?? ''), String(item[sf] ?? '')]))]
        option = {
          color: palette(),
          tooltip: {},
          series: [{
            type: 'graph',
            layout: 'force',
            roam: true,
            data: names.map(name => ({ name })),
            links: items.map(item => ({
              source: String(item[xField] ?? ''),
              target: String(item[sf] ?? ''),
              value: Number(item[yField] ?? 0),
            })),
            label: { show: true, color: textColor() },
            force: { repulsion: 120 },
          }],
        }
        break
      }

      case 'heatmap': {
        const sf = c.seriesField ?? 'y'
        const xs = [...new Set(items.map(item => String(item[xField] ?? '')))]
        const ys = [...new Set(items.map(item => String(item[sf] ?? '')))]
        const cells = items.map(item => [
          xs.indexOf(String(item[xField] ?? '')),
          ys.indexOf(String(item[sf] ?? '')),
          Number(item[yField] ?? 0),
        ])
        const values = cells.map(cell => cell[2])
        option = {
          tooltip: { position: 'top' },
          grid: { left: 0, right: 0, top: 10, bottom: 40, containLabel: true },
          xAxis: { type: 'category', data: xs, axisLabel: { color: axisColor() }, splitArea: { show: true } },
          yAxis: { type: 'category', data: ys, axisLabel: { color: axisColor() }, splitArea: { show: true } },
          visualMap: {
            min: values.length ? Math.min(...values) : 0,
            max: values.length ? Math.max(...values) : 1,
            calculable: true,
            orient: 'horizontal',
            left: 'center',
            bottom: 0,
          },
          series: [{
            type: 'heatmap',
            data: cells,
            label: { show: c.labelShow ?? false },
            emphasis: { itemStyle: { shadowBlur: 10 } },
          }],
        }
        break
      }

      case 'treeMap': {
        option = {
          color: palette(),
          tooltip: { trigger: 'item' },
          series: [{
            type: 'treemap',
            roam: false,
            data: items.map(item => ({ name: String(item[xField] ?? ''), value: Number(item[yField] ?? 0) })),
            label: { show: true, color: textColor() },
            breadcrumb: { show: false },
          }],
        }
        break
      }

      default: {
        option = baseCartesian(xData)
      }
    }

    if (c.rawOption) {
      option = deepMerge(option as Record<string, unknown>, c.rawOption) as echarts.EChartsCoreOption
    }

    return option
  }

  const initChart = () => {
    if (!containerRef.value) return
    if (chart.value && chart.value.getDom() === containerRef.value) return
    const rect = containerRef.value.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
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
    setTimeout(initChart, 60)
    window.addEventListener('resize', resize)
  })

  // 容器尺寸变化（拖拽/缩放/布局变化）→ 自适应重绘
  watch(containerRef, (el) => {
    ro?.disconnect()
    ro = null
    if (!el) {
      chart.value?.dispose()
      chart.value = null
      return
    }
    if (!chart.value) initChart()
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => resize())
      ro.observe(el)
    }
  }, { flush: 'post' })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', resize)
    ro?.disconnect()
    ro = null
    chart.value?.dispose()
  })

  // 数据或配置变化 → 实时重绘
  watch([data, config], () => {
    if (!chart.value) return
    chart.value.setOption(buildOption(), true)
    resize()
  }, { deep: true })

  return { containerRef, chart, resize, setOption }
}
