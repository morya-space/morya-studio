/**
 * 内置卡片注册入口（v0.3）
 * 目录结构对齐 go-view 的分类：图表 / 信息 / 表格 / 媒体 / 装饰 / 基础。
 * 在应用启动时调用 registerBuiltinCards() 一次。
 */

import { registerCard, type EditorFieldSchema } from '../../engine/registry'
import type { CardType } from '../../types/schema'
import StatCard from './StatCard.vue'
import ChartCard from './ChartCard.vue'
import TableCard from './TableCard.vue'
import ListCard from './ListCard.vue'
import BannerCard from './BannerCard.vue'
import TextCard from './TextCard.vue'
import CustomCard from './CustomCard.vue'
import NumberCard from './NumberCard.vue'
import TimeCard from './TimeCard.vue'
import CountdownCard from './CountdownCard.vue'
import ImageCard from './ImageCard.vue'
import VideoCard from './VideoCard.vue'
import IframeCard from './IframeCard.vue'
import ScrollTableCard from './ScrollTableCard.vue'
import IconCard from './IconCard.vue'
import BorderCard from './BorderCard.vue'
import DecorationCard from './DecorationCard.vue'
import ClockCard from './ClockCard.vue'
import FullScreenCard from './FullScreenCard.vue'
import BarrageCard from './BarrageCard.vue'
import CarouselCard from './CarouselCard.vue'
import FormInputCard from './FormInputCard.vue'
import FormSelectCard from './FormSelectCard.vue'
import FormTabsCard from './FormTabsCard.vue'
import PaginationCard from './PaginationCard.vue'
import WordCloudCard from './WordCloudCard.vue'
import WaterPoloCard from './WaterPoloCard.vue'
import Earth3DCard from './Earth3DCard.vue'

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

const ICON_OPTIONS = [
  { label: '星标', value: 'star' },
  { label: '钱包', value: 'wallet' },
  { label: '图表', value: 'bar-chart' },
  { label: '饼图', value: 'pie-chart' },
  { label: '网格', value: 'grid' },
  { label: '文件', value: 'file' },
  { label: '数据库', value: 'database' },
  { label: '用户', value: 'user' },
  { label: '用户组', value: 'users' },
  { label: '设置', value: 'settings' },
  { label: '铃铛', value: 'bell' },
  { label: '信息', value: 'info' },
  { label: '盒子', value: 'box' },
  { label: '图层', value: 'layers' },
  { label: '监控', value: 'monitor' },
  { label: '插头', value: 'plug' },
]

/** 各卡片在自由布局下的默认尺寸（px），供编辑器与迁移共用基表 */
const SIZES: Record<string, { w: number; h: number }> = {
  chart: { w: 420, h: 250 },
  bar: { w: 420, h: 250 },
  line: { w: 420, h: 250 },
  area: { w: 420, h: 250 },
  pie: { w: 380, h: 250 },
  scatter: { w: 420, h: 250 },
  radar: { w: 380, h: 250 },
  funnel: { w: 360, h: 250 },
  gauge: { w: 300, h: 200 },
  barH: { w: 420, h: 250 },
  barLine: { w: 460, h: 260 },
  sankey: { w: 460, h: 280 },
  graph: { w: 420, h: 300 },
  heatmap: { w: 420, h: 280 },
  treeMap: { w: 420, h: 280 },
  wordCloud: { w: 380, h: 250 },
  waterPolo: { w: 240, h: 240 },
  earth3D: { w: 360, h: 360 },
  stat: { w: 250, h: 150 },
  table: { w: 460, h: 250 },
  list: { w: 380, h: 250 },
  banner: { w: 600, h: 120 },
  text: { w: 320, h: 80 },
  number: { w: 240, h: 120 },
  time: { w: 300, h: 72 },
  countdown: { w: 340, h: 100 },
  image: { w: 360, h: 220 },
  video: { w: 400, h: 240 },
  iframe: { w: 520, h: 320 },
  scrollTable: { w: 600, h: 300 },
  icon: { w: 96, h: 96 },
  border: { w: 420, h: 260 },
  decoration: { w: 380, h: 64 },
  circlePoint: { w: 160, h: 160 },
  pipeline: { w: 420, h: 60 },
  flowLine: { w: 420, h: 80 },
  clock: { w: 240, h: 120 },
  fullScreen: { w: 140, h: 48 },
  textGradient: { w: 360, h: 80 },
  barrage: { w: 480, h: 48 },
  carousel: { w: 480, h: 260 },
  formInput: { w: 260, h: 84 },
  formSelect: { w: 260, h: 84 },
  formTabs: { w: 320, h: 60 },
  pagination: { w: 360, h: 60 },
  custom: { w: 320, h: 120 },
}

type ChartKind = 'cartesian' | 'pie' | 'radar' | 'gauge' | 'funnel'

/** 图表组件的属性面板字段（按图表族裁剪） */
function chartFields(kind: ChartKind): EditorFieldSchema[] {
  const fields: EditorFieldSchema[] = [
    { field: 'title', label: '标题', component: 'MInput' },
    { field: 'chart.xField', label: '维度字段', component: 'MSelect', options: 'auto:dataFields' },
    { field: 'chart.yField', label: '数值字段', component: 'MSelect', options: 'auto:dataFields' },
  ]
  if (kind === 'cartesian') {
    fields.push(
      { field: 'chart.seriesField', label: '系列字段', component: 'MSelect', options: 'auto:dataFields' },
      { field: 'chart.smooth', label: '平滑曲线', component: 'MSwitch' },
      { field: 'chart.stack', label: '堆叠', component: 'MSwitch' },
      { field: 'chart.showLegend', label: '显示图例', component: 'MSwitch' },
      { field: 'chart.showGrid', label: '显示坐标轴', component: 'MSwitch' },
    )
  } else if (kind === 'pie') {
    fields.push(
      { field: 'chart.donut', label: '环形', component: 'MSwitch' },
      { field: 'chart.labelShow', label: '显示标签', component: 'MSwitch' },
      { field: 'chart.showLegend', label: '显示图例', component: 'MSwitch' },
    )
  } else if (kind === 'radar') {
    fields.push({ field: 'chart.showLegend', label: '显示图例', component: 'MSwitch' })
  } else if (kind === 'gauge') {
    fields.push({ field: 'chart.max', label: '最大值', component: 'MInputNumber', props: { min: 1 } })
  }
  fields.push({ field: 'chart.height', label: '高度(px)', component: 'MInputNumber', props: { min: 120, max: 900 } })
  return fields
}

let registered = false

export function registerBuiltinCards(): void {
  if (registered) return
  registered = true

  // ==================== 图表（Charts） ====================

  registerCard({
    type: 'chart',
    component: ChartCard,
    label: '图表',
    icon: 'bar-chart',
    description: '通用图表（柱/线/饼/面积/雷达等）',
    category: 'chart',
    defaultSize: SIZES.chart,
    defaultConfig: () => ({
      type: 'chart',
      title: '图表',
      span: 8,
      chart: { chartType: 'bar', xField: 'x', yField: 'y', smooth: true },
    }),
    editorSchema: [
      { field: 'title', label: '标题', component: 'MInput' },
      { field: 'chart.chartType', label: '图表类型', component: 'MSelect', options: CHART_TYPE_OPTIONS },
      ...chartFields('cartesian'),
    ],
  })

  const chartVariants: {
    type: CardType
    label: string
    chartType: string
    kind: ChartKind
    icon: string
    description: string
    /** 覆盖默认 chart 字段，使默认 Mock 数据可直接渲染 */
    extra?: Record<string, unknown>
  }[] = [
    { type: 'bar', label: '柱状图', chartType: 'bar', kind: 'cartesian', icon: 'bar-chart', description: '分类对比' },
    { type: 'line', label: '折线图', chartType: 'line', kind: 'cartesian', icon: 'bar-chart', description: '趋势变化' },
    { type: 'area', label: '面积图', chartType: 'area', kind: 'cartesian', icon: 'bar-chart', description: '趋势 + 累计' },
    { type: 'pie', label: '饼图', chartType: 'pie', kind: 'pie', icon: 'pie-chart', description: '占比分布' },
    { type: 'scatter', label: '散点图', chartType: 'scatter', kind: 'cartesian', icon: 'bar-chart', description: '相关性' },
    { type: 'radar', label: '雷达图', chartType: 'radar', kind: 'radar', icon: 'hive', description: '多维对比' },
    { type: 'funnel', label: '漏斗图', chartType: 'funnel', kind: 'funnel', icon: 'hive', description: '转化漏斗' },
    { type: 'gauge', label: '仪表盘', chartType: 'gauge', kind: 'gauge', icon: 'sliders', description: '单值进度' },
    { type: 'barH', label: '横向柱状图', chartType: 'barH', kind: 'cartesian', icon: 'bar-chart', description: '排行对比' },
    { type: 'barLine', label: '柱线混合', chartType: 'barLine', kind: 'cartesian', icon: 'bar-chart', description: '柱 + 线', extra: { subField: 'line' } },
    { type: 'sankey', label: '桑基图', chartType: 'sankey', kind: 'cartesian', icon: 'hive', description: '流向关系', extra: { seriesField: 'target' } },
    { type: 'graph', label: '关系图', chartType: 'graph', kind: 'cartesian', icon: 'hive', description: '节点关系', extra: { seriesField: 'target' } },
    { type: 'heatmap', label: '热力图', chartType: 'heatmap', kind: 'cartesian', icon: 'grid', description: '二维密度', extra: { seriesField: 'row', yField: 'value' } },
    { type: 'treeMap', label: '矩形树图', chartType: 'treeMap', kind: 'pie', icon: 'grid', description: '层级占比', extra: { xField: 'name', yField: 'value' } },
  ]

  for (const v of chartVariants) {
    registerCard({
      type: v.type,
      component: ChartCard,
      label: v.label,
      icon: v.icon,
      description: v.description,
      category: 'chart',
      defaultSize: SIZES[v.type] ?? SIZES.chart,
      defaultConfig: () => ({
        type: v.type,
        title: v.label,
        span: v.kind === 'gauge' ? 4 : 6,
        chart: { chartType: v.chartType as never, xField: 'x', yField: 'y', smooth: true, ...(v.extra ?? {}) },
      }),
      editorSchema: v.type === 'barLine'
        ? [...chartFields(v.kind), { field: 'chart.subField', label: '折线字段', component: 'MSelect', options: 'auto:dataFields' }]
        : chartFields(v.kind),
    })
  }

  // ==================== 数据卡 ====================

  registerCard({
    type: 'stat',
    component: StatCard,
    label: '指标卡',
    icon: 'wallet',
    description: '单个核心数值 + 趋势',
    category: 'chart',
    defaultSize: SIZES.stat,
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
    type: 'table',
    component: TableCard,
    label: '表格',
    icon: 'grid',
    description: '数据表格 + 分页',
    category: 'table',
    defaultSize: SIZES.table,
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
    type: 'scrollTable',
    component: ScrollTableCard,
    label: '滚动表格',
    icon: 'grid',
    description: '大屏滚动表格',
    category: 'table',
    defaultSize: SIZES.scrollTable,
    defaultConfig: () => ({
      type: 'scrollTable',
      title: '滚动表格',
      span: 12,
      scrollTable: { rowHeight: 36, speed: 40, headShow: true, indexShow: true, stripe: true },
    }),
    editorSchema: [
      { field: 'scrollTable.rowHeight', label: '行高(px)', component: 'MInputNumber', props: { min: 20, max: 80 } },
      { field: 'scrollTable.speed', label: '滚动速度(px/s)', component: 'MInputNumber', props: { min: 0, max: 200 }, help: '0 表示不滚动' },
      { field: 'scrollTable.headShow', label: '显示表头', component: 'MSwitch' },
      { field: 'scrollTable.indexShow', label: '显示序号', component: 'MSwitch' },
      { field: 'scrollTable.stripe', label: '斑马纹', component: 'MSwitch' },
    ],
  })

  registerCard({
    type: 'list',
    component: ListCard,
    label: '列表',
    icon: 'file',
    description: '键值列表 + 趋势',
    category: 'table',
    defaultSize: SIZES.list,
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

  // ==================== 信息（Informations） ====================

  registerCard({
    type: 'banner',
    component: BannerCard,
    label: '横幅',
    icon: 'star',
    description: '品牌渐变横幅 + CTA',
    category: 'information',
    defaultSize: SIZES.banner,
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

  registerCard({
    type: 'text',
    component: TextCard,
    label: '文本',
    icon: 'doc',
    description: '富文本 / 轻量 Markdown',
    category: 'information',
    defaultSize: SIZES.text,
    defaultConfig: () => ({
      type: 'text',
      span: 6,
      text: { content: '# 标题\n\n输入 **文本** 内容，支持轻量 Markdown。', markdown: true },
    }),
    editorSchema: [
      { field: 'title', label: '标题', component: 'MInput' },
      { field: 'text.content', label: '内容', component: 'MTextarea' },
      { field: 'text.markdown', label: 'Markdown', component: 'MSwitch' },
      { field: 'text.fontSize', label: '字号(px)', component: 'MInputNumber', props: { min: 10, max: 72 } },
      { field: 'text.color', label: '文字颜色', component: 'MColorPicker' },
      { field: 'text.align', label: '对齐', component: 'MSelect', options: [
        { label: '左', value: 'left' }, { label: '居中', value: 'center' }, { label: '右', value: 'right' },
      ] },
      { field: 'text.fontWeight', label: '字重', component: 'MSelect', options: [
        { label: '常规', value: 'normal' }, { label: '加粗', value: 'bold' },
      ] },
      { field: 'text.letterSpacing', label: '字间距(px)', component: 'MInputNumber', props: { min: 0, max: 20 } },
      { field: 'text.backgroundColor', label: '背景色', component: 'MColorPicker' },
      { field: 'text.borderWidth', label: '边框粗细', component: 'MInputNumber', props: { min: 0, max: 8 } },
      { field: 'text.borderColor', label: '边框颜色', component: 'MColorPicker' },
      { field: 'text.borderRadius', label: '圆角(px)', component: 'MInputNumber', props: { min: 0, max: 40 } },
      { field: 'text.link', label: '跳转链接', component: 'MInput' },
    ],
  })

  registerCard({
    type: 'number',
    component: NumberCard,
    label: '数字计数',
    icon: 'wallet',
    description: '滚动数字 + 前后缀',
    category: 'information',
    defaultSize: SIZES.number,
    defaultConfig: () => ({
      type: 'number',
      title: '数字',
      span: 4,
      number: { value: 1000, from: 0, duration: 0.8, precision: 0, separator: true, fontSize: 34, color: 'var(--m-color-primary)' },
    }),
    editorSchema: [
      { field: 'number.valueField', label: '数值字段', component: 'MSelect', options: 'auto:dataFields', help: '绑定数据源时生效' },
      { field: 'number.value', label: '静态数值', component: 'MInputNumber' },
      { field: 'number.from', label: '起始值', component: 'MInputNumber' },
      { field: 'number.duration', label: '动画时长(s)', component: 'MInputNumber', props: { min: 0, max: 10, step: 0.1 } },
      { field: 'number.precision', label: '小数位', component: 'MInputNumber', props: { min: 0, max: 6 } },
      { field: 'number.separator', label: '千分位', component: 'MSwitch' },
      { field: 'number.prefix', label: '前缀', component: 'MInput' },
      { field: 'number.suffix', label: '后缀', component: 'MInput' },
      { field: 'number.fontSize', label: '字号(px)', component: 'MInputNumber', props: { min: 12, max: 96 } },
      { field: 'number.color', label: '颜色', component: 'MColorPicker' },
    ],
  })

  registerCard({
    type: 'time',
    component: TimeCard,
    label: '时间',
    icon: 'monitor',
    description: '实时时钟',
    category: 'information',
    defaultSize: SIZES.time,
    defaultConfig: () => ({
      type: 'time',
      span: 6,
      time: { format: 'YYYY-MM-DD HH:mm:ss', fontSize: 22, color: 'var(--m-color-text)' },
    }),
    editorSchema: [
      { field: 'time.format', label: '格式', component: 'MInput', help: '支持 YYYY MM DD HH mm ss' },
      { field: 'time.fontSize', label: '字号(px)', component: 'MInputNumber', props: { min: 12, max: 72 } },
      { field: 'time.color', label: '颜色', component: 'MColorPicker' },
      { field: 'time.bold', label: '加粗', component: 'MSwitch' },
    ],
  })

  registerCard({
    type: 'countdown',
    component: CountdownCard,
    label: '倒计时',
    icon: 'bell',
    description: '目标时间倒计时',
    category: 'information',
    defaultSize: SIZES.countdown,
    defaultConfig: () => ({
      type: 'countdown',
      span: 6,
      countdown: { format: 'DD 天 HH:mm:ss', fontSize: 26, color: 'var(--m-color-primary)' },
    }),
    editorSchema: [
      { field: 'countdown.target', label: '目标时间', component: 'MInput', help: 'ISO 字符串，如 2026-12-31T00:00:00' },
      { field: 'countdown.format', label: '格式', component: 'MInput', help: '支持 DD HH mm ss' },
      { field: 'countdown.fontSize', label: '字号(px)', component: 'MInputNumber', props: { min: 12, max: 72 } },
      { field: 'countdown.color', label: '颜色', component: 'MColorPicker' },
    ],
  })

  registerCard({
    type: 'textGradient',
    component: TextCard,
    label: '渐变文字',
    icon: 'doc',
    description: '渐变标题文字',
    category: 'information',
    defaultSize: SIZES.textGradient,
    defaultConfig: () => ({
      type: 'textGradient',
      span: 6,
      text: { content: '渐变标题', markdown: false, gradient: true, fontSize: 28, fontWeight: 'bold', align: 'center' },
    }),
    editorSchema: [
      { field: 'text.content', label: '内容', component: 'MTextarea' },
      { field: 'text.gradient', label: '渐变', component: 'MSwitch' },
      { field: 'text.fontSize', label: '字号(px)', component: 'MInputNumber', props: { min: 10, max: 96 } },
      { field: 'text.fontWeight', label: '字重', component: 'MSelect', options: [
        { label: '常规', value: 'normal' }, { label: '加粗', value: 'bold' },
      ] },
      { field: 'text.align', label: '对齐', component: 'MSelect', options: [
        { label: '左', value: 'left' }, { label: '居中', value: 'center' }, { label: '右', value: 'right' },
      ] },
    ],
  })

  registerCard({
    type: 'barrage',
    component: BarrageCard,
    label: '跑马灯',
    icon: 'more',
    description: '横向滚动文字',
    category: 'information',
    defaultSize: SIZES.barrage,
    defaultConfig: () => ({
      type: 'barrage',
      span: 12,
      barrage: { text: '这是一条滚动通知消息', speed: 80, fontSize: 16, color: 'var(--m-color-text)' },
    }),
    editorSchema: [
      { field: 'barrage.text', label: '文本', component: 'MInput' },
      { field: 'barrage.speed', label: '速度(px/s)', component: 'MInputNumber', props: { min: 10, max: 400 } },
      { field: 'barrage.fontSize', label: '字号(px)', component: 'MInputNumber', props: { min: 12, max: 48 } },
      { field: 'barrage.color', label: '颜色', component: 'MColorPicker' },
    ],
  })

  registerCard({
    type: 'carousel',
    component: CarouselCard,
    label: '轮播',
    icon: 'box',
    description: '多图轮播',
    category: 'information',
    defaultSize: SIZES.carousel,
    defaultConfig: () => ({
      type: 'carousel',
      span: 6,
      carousel: { urls: [], interval: 3, radius: 8 },
    }),
    editorSchema: [
      { field: 'carousel.interval', label: '切换间隔(s)', component: 'MInputNumber', props: { min: 1, max: 30 } },
      { field: 'carousel.radius', label: '圆角(px)', component: 'MInputNumber', props: { min: 0, max: 40 } },
      { field: 'carousel.urls', label: '图片 URL', component: 'MTextarea', help: '每行一个 URL' },
    ],
  })

  registerCard({
    type: 'formInput',
    component: FormInputCard,
    label: '输入框',
    icon: 'doc',
    description: '大屏筛选输入',
    category: 'information',
    defaultSize: SIZES.formInput,
    defaultConfig: () => ({
      type: 'formInput',
      span: 4,
      formInput: { label: '关键词', placeholder: '请输入', modelKey: 'keyword' },
    }),
    editorSchema: [
      { field: 'formInput.label', label: '标签', component: 'MInput' },
      { field: 'formInput.placeholder', label: '占位', component: 'MInput' },
      { field: 'formInput.modelKey', label: '变量名', component: 'MInput', help: '注入到数据源参数' },
    ],
  })

  registerCard({
    type: 'formSelect',
    component: FormSelectCard,
    label: '下拉选择',
    icon: 'grid',
    description: '大屏筛选下拉',
    category: 'information',
    defaultSize: SIZES.formSelect,
    defaultConfig: () => ({
      type: 'formSelect',
      span: 4,
      formSelect: { label: '地区', placeholder: '请选择', options: [], modelKey: 'region' },
    }),
    editorSchema: [
      { field: 'formSelect.label', label: '标签', component: 'MInput' },
      { field: 'formSelect.placeholder', label: '占位', component: 'MInput' },
      { field: 'formSelect.modelKey', label: '变量名', component: 'MInput', help: '注入到数据源参数' },
      { field: 'formSelect.options', label: '选项', component: 'MTextarea', help: 'JSON：{"label":"x","value":"y"} 数组' },
    ],
  })

  registerCard({
    type: 'formTabs',
    component: FormTabsCard,
    label: '页签',
    icon: 'layout',
    description: '大屏分段切换',
    category: 'information',
    defaultSize: SIZES.formTabs,
    defaultConfig: () => ({
      type: 'formTabs',
      span: 6,
      formTabs: { tabs: ['全部', '进行中', '已完成'], modelKey: 'tab' },
    }),
    editorSchema: [
      { field: 'formTabs.tabs', label: '页签', component: 'MTextarea', help: '每行一个' },
      { field: 'formTabs.modelKey', label: '变量名', component: 'MInput' },
    ],
  })

  registerCard({
    type: 'pagination',
    component: PaginationCard,
    label: '分页',
    icon: 'more',
    description: '大屏分页控件',
    category: 'information',
    defaultSize: SIZES.pagination,
    defaultConfig: () => ({
      type: 'pagination',
      span: 6,
      pagination: { total: 100, pageSize: 10, modelKey: 'page' },
    }),
    editorSchema: [
      { field: 'pagination.total', label: '总条数', component: 'MInputNumber', props: { min: 0 } },
      { field: 'pagination.pageSize', label: '每页条数', component: 'MInputNumber', props: { min: 1 } },
      { field: 'pagination.modelKey', label: '变量名', component: 'MInput' },
    ],
  })

  registerCard({
    type: 'wordCloud',
    component: WordCloudCard,
    label: '词云',
    icon: 'hive',
    description: '关键词权重云',
    category: 'chart',
    defaultSize: SIZES.wordCloud,
    defaultConfig: () => ({
      type: 'wordCloud',
      title: '词云',
      span: 6,
      wordCloud: { textField: 'name', valueField: 'value', minSize: 14, maxSize: 34 },
    }),
    editorSchema: [
      { field: 'title', label: '标题', component: 'MInput' },
      { field: 'wordCloud.textField', label: '文本字段', component: 'MSelect', options: 'auto:dataFields' },
      { field: 'wordCloud.valueField', label: '权重字段', component: 'MSelect', options: 'auto:dataFields' },
      { field: 'wordCloud.minSize', label: '最小字号', component: 'MInputNumber', props: { min: 8, max: 40 } },
      { field: 'wordCloud.maxSize', label: '最大字号', component: 'MInputNumber', props: { min: 12, max: 72 } },
      { field: 'wordCloud.color', label: '颜色', component: 'MColorPicker' },
    ],
  })

  registerCard({
    type: 'waterPolo',
    component: WaterPoloCard,
    label: '水球',
    icon: 'sliders',
    description: '水位进度',
    category: 'chart',
    defaultSize: SIZES.waterPolo,
    defaultConfig: () => ({
      type: 'waterPolo',
      title: '水球',
      span: 4,
      waterPolo: { valueField: 'value', value: 60, max: 100, precision: 0, color: 'var(--m-color-primary)' },
    }),
    editorSchema: [
      { field: 'waterPolo.valueField', label: '数值字段', component: 'MSelect', options: 'auto:dataFields' },
      { field: 'waterPolo.value', label: '静态数值', component: 'MInputNumber' },
      { field: 'waterPolo.max', label: '最大值', component: 'MInputNumber', props: { min: 1 } },
      { field: 'waterPolo.precision', label: '小数位', component: 'MInputNumber', props: { min: 0, max: 4 } },
      { field: 'waterPolo.color', label: '颜色', component: 'MColorPicker' },
    ],
  })

  // ==================== 媒体（Media） ====================

  registerCard({
    type: 'image',
    component: ImageCard,
    label: '图片',
    icon: 'box',
    description: '图片 / 背景图',
    category: 'media',
    defaultSize: SIZES.image,
    defaultConfig: () => ({
      type: 'image',
      span: 6,
      image: { fit: 'contain', radius: 8 },
    }),
    editorSchema: [
      { field: 'image.url', label: '图片 URL', component: 'MInput' },
      { field: 'image.fit', label: '适应方式', component: 'MSelect', options: [
        { label: '包含', value: 'contain' }, { label: '覆盖', value: 'cover' },
        { label: '拉伸', value: 'fill' }, { label: '原始', value: 'none' },
      ] },
      { field: 'image.radius', label: '圆角(px)', component: 'MInputNumber', props: { min: 0, max: 40 } },
    ],
  })

  registerCard({
    type: 'video',
    component: VideoCard,
    label: '视频',
    icon: 'monitor',
    description: '本地/在线视频',
    category: 'media',
    defaultSize: SIZES.video,
    defaultConfig: () => ({
      type: 'video',
      span: 6,
      video: { fit: 'contain', muted: true, loop: true, autoplay: true, controls: false },
    }),
    editorSchema: [
      { field: 'video.url', label: '视频 URL', component: 'MInput' },
      { field: 'video.fit', label: '适应方式', component: 'MSelect', options: [
        { label: '包含', value: 'contain' }, { label: '覆盖', value: 'cover' }, { label: '拉伸', value: 'fill' },
      ] },
      { field: 'video.muted', label: '静音', component: 'MSwitch' },
      { field: 'video.loop', label: '循环', component: 'MSwitch' },
      { field: 'video.autoplay', label: '自动播放', component: 'MSwitch' },
      { field: 'video.controls', label: '显示控件', component: 'MSwitch' },
    ],
  })

  registerCard({
    type: 'iframe',
    component: IframeCard,
    label: '内嵌网页',
    icon: 'monitor',
    description: '嵌入外部页面',
    category: 'media',
    defaultSize: SIZES.iframe,
    defaultConfig: () => ({
      type: 'iframe',
      span: 12,
      iframe: { url: '', title: '内嵌页面' },
    }),
    editorSchema: [
      { field: 'iframe.url', label: 'URL', component: 'MInput', help: '仅支持 http/https' },
      { field: 'iframe.title', label: '标题', component: 'MInput' },
    ],
  })

  // ==================== 装饰（Decorates） ====================

  registerCard({
    type: 'icon',
    component: IconCard,
    label: '图标',
    icon: 'star',
    description: '内置图标',
    category: 'decorate',
    defaultSize: SIZES.icon,
    defaultConfig: () => ({
      type: 'icon',
      span: 2,
      icon: { name: 'star', size: 32, color: 'var(--m-color-primary)' },
    }),
    editorSchema: [
      { field: 'icon.name', label: '图标', component: 'MSelect', options: ICON_OPTIONS },
      { field: 'icon.size', label: '大小(px)', component: 'MInputNumber', props: { min: 12, max: 160 } },
      { field: 'icon.color', label: '颜色', component: 'MColorPicker' },
    ],
  })

  registerCard({
    type: 'border',
    component: BorderCard,
    label: '边框',
    icon: 'box',
    description: '边框装饰',
    category: 'decorate',
    defaultSize: SIZES.border,
    defaultConfig: () => ({
      type: 'border',
      span: 6,
      decorate: { variant: 'border01', color: 'var(--m-color-primary)' },
    }),
    editorSchema: [
      { field: 'decorate.variant', label: '样式', component: 'MSelect', options: [
        { label: '边框-01 四角', value: 'border01' },
        { label: '边框-02 标题角', value: 'border02' },
        { label: '边框-03 左侧条', value: 'border03' },
        { label: '边框-04 虚线', value: 'border04' },
        { label: '边框-05 上下线', value: 'border05' },
        { label: '边框-06 内发光', value: 'border06' },
        { label: '边框-07 对角', value: 'border07' },
        { label: '边框-08 顶条', value: 'border08' },
        { label: '边框-09 双线', value: 'border09' },
        { label: '边框-10 角点', value: 'border10' },
        { label: '边框-11 侧条', value: 'border11' },
        { label: '边框-12 霓虹', value: 'border12' },
        { label: '边框-13 括角', value: 'border13' },
      ] },
      { field: 'decorate.color', label: '颜色', component: 'MColorPicker' },
      { field: 'decorate.background', label: '背景色', component: 'MColorPicker' },
    ],
  })

  registerCard({
    type: 'circlePoint',
    component: DecorationCard,
    label: '环形装饰',
    icon: 'sync',
    description: '旋转虚线环',
    category: 'decorate',
    defaultSize: SIZES.circlePoint,
    defaultConfig: () => ({ type: 'circlePoint', span: 2, decorate: { variant: 'circle', color: 'var(--m-color-primary)' } }),
    editorSchema: [
      { field: 'decorate.color', label: '颜色', component: 'MColorPicker' },
    ],
  })

  registerCard({
    type: 'pipeline',
    component: DecorationCard,
    label: '管道',
    icon: 'more',
    description: '管道（水平/垂直）',
    category: 'decorate',
    defaultSize: SIZES.pipeline,
    defaultConfig: () => ({ type: 'pipeline', span: 6, decorate: { variant: 'pipeline-h', color: 'var(--m-color-primary)' } }),
    editorSchema: [
      { field: 'decorate.variant', label: '方向', component: 'MSelect', options: [
        { label: '水平', value: 'pipeline-h' }, { label: '垂直', value: 'pipeline-v' },
      ] },
      { field: 'decorate.color', label: '颜色', component: 'MColorPicker' },
    ],
  })

  registerCard({
    type: 'flowLine',
    component: DecorationCard,
    label: '流动线',
    icon: 'sync',
    description: '流动虚线',
    category: 'decorate',
    defaultSize: SIZES.flowLine,
    defaultConfig: () => ({ type: 'flowLine', span: 6, decorate: { variant: 'flow', color: 'var(--m-color-primary)' } }),
    editorSchema: [
      { field: 'decorate.color', label: '颜色', component: 'MColorPicker' },
    ],
  })

  registerCard({
    type: 'clock',
    component: ClockCard,
    label: '时钟',
    icon: 'monitor',
    description: '数字 / 指针时钟',
    category: 'decorate',
    defaultSize: SIZES.clock,
    defaultConfig: () => ({ type: 'clock', span: 4, clock: { mode: 'digital', format: 'HH:mm:ss', fontSize: 28, color: 'var(--m-color-primary)' } }),
    editorSchema: [
      { field: 'clock.mode', label: '模式', component: 'MSelect', options: [
        { label: '数字', value: 'digital' }, { label: '指针', value: 'analog' },
      ] },
      { field: 'clock.format', label: '格式', component: 'MInput', help: '数字模式：YYYY MM DD HH mm ss' },
      { field: 'clock.fontSize', label: '字号(px)', component: 'MInputNumber', props: { min: 12, max: 72 } },
      { field: 'clock.color', label: '颜色', component: 'MColorPicker' },
    ],
  })

  registerCard({
    type: 'fullScreen',
    component: FullScreenCard,
    label: '全屏按钮',
    icon: 'monitor',
    description: '切换浏览器全屏',
    category: 'decorate',
    defaultSize: SIZES.fullScreen,
    defaultConfig: () => ({ type: 'fullScreen', span: 2, fullScreen: { text: '全屏' } }),
    editorSchema: [
      { field: 'fullScreen.text', label: '按钮文案', component: 'MInput' },
      { field: 'fullScreen.color', label: '颜色', component: 'MColorPicker' },
    ],
  })

  registerCard({
    type: 'decoration',
    component: DecorationCard,
    label: '装饰线条',
    icon: 'more',
    description: '线条 / 标题条',
    category: 'decorate',
    defaultSize: SIZES.decoration,
    defaultConfig: () => ({
      type: 'decoration',
      span: 6,
      decorate: { variant: 'title', title: '标题', color: 'var(--m-color-primary)' },
    }),
    editorSchema: [
      { field: 'decorate.variant', label: '样式', component: 'MSelect', options: [
        { label: '标题条', value: 'title' },
        { label: '横线', value: 'line-h' },
        { label: '竖线', value: 'line-v' },
        { label: '双线', value: 'line-dual' },
        { label: '取景框', value: 'box' },
        { label: '对角框', value: 'corner' },
      ] },
      { field: 'decorate.title', label: '标题', component: 'MInput' },
      { field: 'decorate.color', label: '颜色', component: 'MColorPicker' },
    ],
  })

  registerCard({
    type: 'earth3D',
    component: Earth3DCard,
    label: '3D 地球',
    icon: 'hive',
    description: 'Three.js 线框地球',
    category: 'decorate',
    defaultSize: SIZES.earth3D,
    defaultConfig: () => ({ type: 'earth3D', span: 4, earth3D: { autoRotate: true, speed: 1 } }),
    editorSchema: [
      { field: 'earth3D.autoRotate', label: '自转', component: 'MSwitch' },
      { field: 'earth3D.speed', label: '速度', component: 'MInputNumber', props: { min: 0, max: 5, step: 0.1 } },
      { field: 'earth3D.color', label: '颜色', component: 'MColorPicker' },
    ],
  })

  // ==================== 基础 / 逃生舱 ====================

  registerCard({
    type: 'custom',
    component: CustomCard,
    label: '自定义',
    icon: 'code',
    description: '逃生舱：渲染自定义 HTML',
    category: 'basic',
    defaultSize: SIZES.custom,
    defaultConfig: () => ({
      type: 'custom',
      span: 6,
      custom: { html: '<div style="padding:8px 0">自定义内容</div>' },
    }),
    editorSchema: [
      { field: 'title', label: '标题', component: 'MInput' },
      { field: 'custom.html', label: 'HTML', component: 'MTextarea' },
    ],
  })
}

export {
  StatCard,
  ChartCard,
  TableCard,
  ListCard,
  BannerCard,
  TextCard,
  CustomCard,
  NumberCard,
  TimeCard,
  CountdownCard,
  ImageCard,
  VideoCard,
  IframeCard,
  ScrollTableCard,
  IconCard,
  BorderCard,
  DecorationCard,
  ClockCard,
  FullScreenCard,
  BarrageCard,
  CarouselCard,
  FormInputCard,
  FormSelectCard,
  FormTabsCard,
  PaginationCard,
  WordCloudCard,
  WaterPoloCard,
  Earth3DCard,
}
