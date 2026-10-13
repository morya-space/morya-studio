/**
 * Morya Studio 核心类型定义
 * 行业无关的数据驱动可视化页面生成系统
 */

// ==================== 数据源 ====================

export type DataSourceType = 'static' | 'api' | 'mock'

export interface DataSourceConfig {
  type: DataSourceType
  url?: string
  method?: 'GET' | 'POST'
  params?: Record<string, unknown>
  staticData?: Record<string, unknown>[]
  transform?: string
}

// ==================== 图表 ====================

export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'radar' | 'scatter'

export interface ChartConfig {
  chartType: ChartType
  xField?: string
  yField?: string
  seriesField?: string
  colors?: string[]
  smooth?: boolean
  showLegend?: boolean
  showGrid?: boolean
  showTooltip?: boolean
  height?: number
}

// ==================== 指标卡 ====================

export interface StatConfig {
  valueField: string
  labelField?: string
  prefix?: string
  suffix?: string
  precision?: number
  trendField?: string
  trendType?: 'up' | 'down' | 'auto'
}

// ==================== 表格 ====================

export interface TableColumn {
  key: string
  title: string
  width?: number | string
  align?: 'left' | 'center' | 'right'
  render?: 'text' | 'number' | 'currency' | 'percent' | 'date' | 'status'
  statusMap?: Record<string, { type: 'success' | 'warning' | 'danger' | 'info'; label: string }>
}

export interface TableConfig {
  columns: TableColumn[]
  rowKey?: string
  showPagination?: boolean
  pageSize?: number
}

// ==================== 列表 ====================

export interface ListItemConfig {
  iconField?: string
  titleField: string
  subtitleField?: string
  valueField: string
  valueType?: 'number' | 'currency' | 'percent'
  trendField?: string
}

// ==================== 卡片 ====================

export type CardType = 'stat' | 'chart' | 'table' | 'list' | 'banner' | 'custom'

export interface CardSchema {
  id: string
  type: CardType
  title?: string
  subtitle?: string
  span?: number
  order?: number
  dataSource: DataSourceConfig
  chart?: ChartConfig
  stat?: StatConfig
  table?: TableConfig
  list?: ListItemConfig
  banner?: BannerConfig
  actions?: ActionConfig[]
}

export interface BannerConfig {
  title: string
  description?: string
  buttonText?: string
  buttonAction?: string
  gradient?: string
}

export interface ActionConfig {
  label: string
  icon?: string
  type?: 'primary' | 'secondary' | 'danger'
  action: string
}

// ==================== 页面 ====================

export type LayoutMode = 'grid' | 'free'

export interface GridConfig {
  cols?: number
  gap?: number
  rowHeight?: number
}

export interface PageSchema {
  id: string
  title: string
  layout: LayoutMode
  grid?: GridConfig
  cards: CardSchema[]
  theme?: ThemeOverride
}

export interface ThemeOverride {
  primaryColor?: string
  gradient?: string
  cardRadius?: number
  cardShadow?: string
}

// ==================== 组件渲染 ====================

export interface RenderContext {
  schema: PageSchema
  data: Map<string, Record<string, unknown>[]>
  loading: Map<string, boolean>
  error: Map<string, Error>
}

export interface ComponentMapping {
  type: CardType
  component: string
  props?: Record<string, unknown>
}
