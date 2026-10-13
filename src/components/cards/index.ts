/**
 * 内置卡片注册入口
 * 在应用启动时调用 registerBuiltinCards() 一次。
 */

import { registerCard } from '../../engine/registry'
import StatCard from './StatCard.vue'
import ChartCard from './ChartCard.vue'
import TableCard from './TableCard.vue'
import ListCard from './ListCard.vue'
import BannerCard from './BannerCard.vue'

const CHART_TYPE_OPTIONS = [
  { label: '柱状图', value: 'bar' },
  { label: '折线图', value: 'line' },
  { label: '面积图', value: 'area' },
  { label: '饼图', value: 'pie' },
  { label: '雷达图', value: 'radar' },
  { label: '散点图', value: 'scatter' },
  { label: '漏斗图', value: 'funnel' },
  { label: '仪表盘', value: 'gauge' },
]

let registered = false

export function registerBuiltinCards(): void {
  if (registered) return
  registered = true

  registerCard({
    type: 'stat',
    component: StatCard,
    label: '指标卡',
    icon: 'wallet',
    description: '单个核心数值 + 趋势',
    defaultConfig: () => ({
      type: 'stat',
      title: '指标',
      span: 4,
      stat: { valueField: 'value' },
    }),
    editorSchema: [
      { field: 'title', label: '标题', component: 'MInput' },
      { field: 'stat.valueField', label: '数值字段', component: 'MSelect', options: 'auto:dataFields' },
      { field: 'stat.labelField', label: '标签字段', component: 'MSelect', options: 'auto:dataFields' },
      { field: 'stat.prefix', label: '前缀', component: 'MInput' },
      { field: 'stat.suffix', label: '后缀', component: 'MInput' },
      { field: 'stat.precision', label: '小数位', component: 'MInputNumber', props: { min: 0, max: 6 } },
      { field: 'stat.trendField', label: '趋势字段', component: 'MSelect', options: 'auto:dataFields' },
    ],
  })

  registerCard({
    type: 'chart',
    component: ChartCard,
    label: '图表',
    icon: 'bar-chart',
    description: '柱/线/饼/面积/雷达等',
    defaultConfig: () => ({
      type: 'chart',
      title: '图表',
      span: 8,
      chart: { chartType: 'bar', xField: 'x', yField: 'y', smooth: true },
    }),
    editorSchema: [
      { field: 'title', label: '标题', component: 'MInput' },
      { field: 'chart.chartType', label: '图表类型', component: 'MSelect', options: CHART_TYPE_OPTIONS },
      { field: 'chart.xField', label: 'X 轴字段', component: 'MSelect', options: 'auto:dataFields' },
      { field: 'chart.yField', label: 'Y 轴字段', component: 'MSelect', options: 'auto:dataFields' },
      { field: 'chart.seriesField', label: '系列字段', component: 'MSelect', options: 'auto:dataFields' },
      { field: 'chart.smooth', label: '平滑曲线', component: 'MSwitch' },
      { field: 'chart.stack', label: '堆叠', component: 'MSwitch' },
      { field: 'chart.showLegend', label: '显示图例', component: 'MSwitch' },
      { field: 'chart.height', label: '高度(px)', component: 'MInputNumber', props: { min: 120, max: 800 } },
    ],
  })

  registerCard({
    type: 'table',
    component: TableCard,
    label: '表格',
    icon: 'grid',
    description: '数据表格 + 分页',
    defaultConfig: () => ({
      type: 'table',
      title: '表格',
      span: 12,
      table: { columns: [], showPagination: true, pageSize: 10 },
    }),
    editorSchema: [
      { field: 'title', label: '标题', component: 'MInput' },
      { field: 'table.pageSize', label: '每页条数', component: 'MInputNumber', props: { min: 5, max: 100 } },
      { field: 'table.showPagination', label: '显示分页', component: 'MSwitch' },
    ],
  })

  registerCard({
    type: 'list',
    component: ListCard,
    label: '列表',
    icon: 'file',
    description: '键值列表 + 趋势',
    defaultConfig: () => ({
      type: 'list',
      title: '列表',
      span: 6,
      list: { titleField: 'name', valueField: 'value', valueType: 'number' },
    }),
    editorSchema: [
      { field: 'title', label: '标题', component: 'MInput' },
      { field: 'list.titleField', label: '标题字段', component: 'MSelect', options: 'auto:dataFields' },
      { field: 'list.subtitleField', label: '副标题字段', component: 'MSelect', options: 'auto:dataFields' },
      { field: 'list.valueField', label: '数值字段', component: 'MSelect', options: 'auto:dataFields' },
      { field: 'list.trendField', label: '趋势字段', component: 'MSelect', options: 'auto:dataFields' },
    ],
  })

  registerCard({
    type: 'banner',
    component: BannerCard,
    label: '横幅',
    icon: 'star',
    description: '品牌渐变横幅 + CTA',
    defaultConfig: () => ({
      type: 'banner',
      span: 12,
      banner: { title: '横幅标题', description: '', buttonText: '' },
    }),
    editorSchema: [
      { field: 'banner.title', label: '标题', component: 'MInput' },
      { field: 'banner.description', label: '描述', component: 'MTextarea' },
      { field: 'banner.buttonText', label: '按钮文案', component: 'MInput' },
      { field: 'banner.buttonAction', label: '按钮动作', component: 'MInput' },
    ],
  })
}

export { StatCard, ChartCard, TableCard, ListCard, BannerCard }
