import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref } from 'vue'
import type { ChartConfig } from '../types/schema'

// 注册必要的 ECharts 组件
echarts.use([
  BarChart,
  LineChart,
  PieChart,
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

export function useECharts(config: ChartConfig, data: Ref<Record<string, unknown>[]>): UseEChartsReturn {
  const containerRef = ref<HTMLElement | null>(null)
  const chart = shallowRef<echarts.ECharts | null>(null)

  const buildOption = (): echarts.EChartsCoreOption => {
    const items = data.value
    const xField = config.xField ?? 'x'
    const yField = config.yField ?? 'y'

    const xData = items.map(item => String(item[xField] ?? ''))
    const yData = items.map(item => Number(item[yField] ?? 0))

    const baseOption: echarts.EChartsCoreOption = {
      grid: {
        show: false,
        left: 0,
        right: 0,
        top: 10,
        bottom: 0,
        containLabel: true,
      },
      tooltip: {
        show: config.showTooltip !== false,
        trigger: 'axis',
      },
      legend: {
        show: config.showLegend ?? false,
      },
      xAxis: {
        type: 'category',
        data: xData,
        show: config.showGrid !== false,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#9CA3AF',
          fontSize: 12,
        },
      },
      yAxis: {
        type: 'value',
        show: config.showGrid !== false,
        splitLine: {
          lineStyle: {
            color: '#F0F0F0',
          },
        },
        axisLabel: {
          color: '#9CA3AF',
          fontSize: 12,
        },
      },
    }

    const colorPalette = config.colors ?? ['#6366F1', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6']

    switch (config.chartType) {
      case 'bar':
        return {
          ...baseOption,
          color: colorPalette,
          series: [{
            type: 'bar',
            data: yData,
            barWidth: '60%',
            itemStyle: {
              borderRadius: [4, 4, 0, 0],
            },
          }],
        }

      case 'line':
        return {
          ...baseOption,
          color: colorPalette,
          series: [{
            type: 'line',
            data: yData,
            smooth: config.smooth ?? true,
            lineStyle: { width: 3 },
            areaStyle: undefined,
          }],
        }

      case 'pie':
        return {
          color: colorPalette,
          tooltip: { trigger: 'item' },
          series: [{
            type: 'pie',
            radius: ['40%', '70%'],
            data: items.map(item => ({
              name: String(item[xField] ?? ''),
              value: Number(item[yField] ?? 0),
            })),
            label: { show: false },
          }],
        }

      default:
        return baseOption
    }
  }

  const initChart = () => {
    if (!containerRef.value) return

    // 确保容器有尺寸
    const rect = containerRef.value.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      console.warn('ECharts container has zero size', rect)
      return
    }

    chart.value = echarts.init(containerRef.value)
    chart.value.setOption(buildOption())
  }

  const resize = () => {
    chart.value?.resize()
  }

  const setOption = (option: echarts.EChartsCoreOption) => {
    chart.value?.setOption(option)
  }

  onMounted(() => {
    // 延迟初始化确保 DOM 已渲染
    setTimeout(() => {
      initChart()
    }, 100)
    window.addEventListener('resize', resize)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', resize)
    chart.value?.dispose()
  })

  watch(data, () => {
    if (chart.value) {
      chart.value.setOption(buildOption())
    }
  }, { deep: true })

  return {
    containerRef,
    chart,
    resize,
    setOption,
  }
}
