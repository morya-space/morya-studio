/**
 * Morya Studio 核心类型定义
 * 行业无关的数据驱动可视化页面生成系统
 *
 * 契约见 docs/DESIGN-DEV.md §5 Schema DSL 规范。
 * 标注 `v0.2` 的字段为本轮 Schema 升级新增；旧字段保留以向后兼容。
 */

/** 当前 Schema 结构版本，用于 migrate（见 src/engine/migrate.ts） */
export const SCHEMA_VERSION = 2

// ==================== 数据源 ====================

export type DataSourceType = 'static' | 'api' | 'mock' | 'websocket' | 'sql'

export interface DataSourceAuth {
  type: 'none' | 'bearer' | 'apikey' | 'basic'
  token?: string
  apiKeyName?: string
  apiKeyValue?: string
  /** basic 认证 */
  username?: string
  password?: string
}

export interface DataSourceCache {
  enabled?: boolean
  /** 缓存有效期（ms） */
  ttl?: number
  storage?: 'memory' | 'localStorage'
}

export interface DataSourceConfig {
  /** v0.2：数据源唯一 ID（项目内，供 Card.dataSourceId 引用）。内联数据源可省略 */
  id?: string
  /** v0.2：名称（编辑器内展示） */
  name?: string
  type: DataSourceType
  url?: string
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  params?: Record<string, unknown>
  staticData?: Record<string, unknown>[]
  /** v0.2：响应数据路径（lodash get 语法），如 "data.list" */
  dataPath?: string
  /** v0.2：Mock.js 模板语法 */
  mockTemplate?: string
  /** v0.2：WebSocket 地址 */
  wsUrl?: string
  /** v0.2：轮询间隔（ms），0 或不填表示不轮询 */
  pollInterval?: number
  /** v0.2：缓存策略 */
  cache?: DataSourceCache
  /** v0.2：认证（编辑器中加密存储，运行时注入 header） */
  auth?: DataSourceAuth
  /** v0.2：SQL 数据源连接与查询（经后端代理执行，避免 CORS 与凭证暴露） */
  sql?: SqlConfig
  /**
   * @deprecated v0.2 起用 Card.transform（TransformStep[]）替代。
   * 保留以兼容旧 schema，将在 v0.3 移除。
   */
  transform?: string
}

// ==================== SQL 数据源（v0.2） ====================

export interface SqlConfig {
  driver?: 'mysql' | 'postgresql' | 'sqlserver'
  host?: string
  port?: number
  database?: string
  user?: string
  password?: string
  /** 查询 SQL，返回行数组 */
  query?: string
  /** 结果行数上限（后端截断，防御性） */
  limit?: number
}

// ==================== 数据转换管道（v0.2） ====================

export type TransformStep =
  | { op: 'filter'; expr: string }
  | { op: 'sort'; field: string; order?: 'asc' | 'desc' }
  | { op: 'limit'; count: number }
  | { op: 'map'; expr: string }
  | { op: 'groupBy'; field: string; aggs: Record<string, 'sum' | 'avg' | 'count' | 'max' | 'min'> }
  | { op: 'rename'; fields: Record<string, string> }

// ==================== 图表 ====================

export type ChartType =
  | 'bar'
  | 'line'
  | 'pie'
  | 'area'
  | 'radar'
  | 'scatter'
  | 'funnel'
  | 'gauge'

export interface ChartYAxisConfig {
  title?: string
  format?: 'number' | 'currency' | 'percent'
}

export interface ChartConfig {
  chartType: ChartType
  xField?: string
  yField?: string
  seriesField?: string
  /** 颜色调色板；缺省读 --m-chart-* token */
  colors?: string[]
  smooth?: boolean
  showLegend?: boolean
  showGrid?: boolean
  showTooltip?: boolean
  /** v0.2：堆叠（bar / area） */
  stack?: boolean
  /** v0.2：Y 轴配置 */
  yAxis?: ChartYAxisConfig
  height?: number
  /** v0.2：ECharts 原生 option 补丁（逃生舱，深度合并到最后） */
  rawOption?: Record<string, unknown>
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

export type CardType =
  | 'stat'
  | 'chart'
  | 'table'
  | 'list'
  | 'banner'
  | 'text'
  | 'custom'

export interface CardStateText {
  loading?: string
  empty?: string
  error?: string
}

export interface CardSchema {
  id: string
  type: CardType
  title?: string
  subtitle?: string
  span?: number
  order?: number
  /** v0.2：固定高度（px），缺省自适应 */
  height?: number

  /** v0.2：自由布局（layout: 'free'）几何信息，px */
  x?: number
  y?: number
  w?: number
  h?: number

  /** v0.2：数据源引用（优先）。与内联 dataSource 二选一 */
  dataSourceId?: string
  /** 内联数据源（向后兼容；编辑器引导迁移到 dataSourceId） */
  dataSource?: DataSourceConfig
  /** v0.2：数据转换管道（数据到达卡片前执行） */
  transform?: TransformStep[]

  chart?: ChartConfig
  stat?: StatConfig
  table?: TableConfig
  list?: ListItemConfig
  banner?: BannerConfig
  text?: TextConfig
  custom?: CustomConfig

  actions?: ActionConfig[]
  /** v0.2：加载/空/错误三态文案覆盖 */
  stateText?: CardStateText
}

// ==================== 文本 / 自定义卡片（v0.2） ====================

export interface TextConfig {
  /** 文本内容（纯文本或轻量 Markdown） */
  content?: string
  /** 按轻量 Markdown 渲染（标题/粗体/斜体/链接/列表/行内代码） */
  markdown?: boolean
}

export interface CustomConfig {
  /** 逃生舱：直接渲染的 HTML（作者自担风险） */
  html?: string
  /** 备用：以 JSON 形式展示自定义 props */
  props?: Record<string, unknown>
}

export interface BannerConfig {
  title: string
  description?: string
  buttonText?: string
  buttonAction?: string
  /** 渐变背景；缺省用 var(--m-gradient-brand)。值来自 schema，属用户数据 */
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

export interface GridBreakpoints {
  lg?: number
  md?: number
  sm?: number
}

export interface GridConfig {
  cols?: number
  gap?: number
  rowHeight?: number | 'auto'
  /** v0.2：响应式断点 */
  breakpoints?: GridBreakpoints
}

export interface PageMeta {
  createdAt?: string
  updatedAt?: string
  createdBy?: string
  /** Schema 结构版本，用于迁移 */
  version?: number
}

export interface PageSchema {
  id: string
  title: string
  /** v0.2：页面描述（SEO / 分享卡片） */
  description?: string
  layout: LayoutMode
  grid?: GridConfig
  cards: CardSchema[]
  theme?: ThemeOverride
  /** v0.2：画布样式与编辑辅助配置（背景/网格/吸附/尺寸） */
  canvas?: CanvasConfig
  /** v0.2：页面级全局过滤器定义（运行时参数注入到各卡片数据源） */
  filters?: PageFilter[]
  /** v0.2：页面元信息 */
  meta?: PageMeta
}

// ==================== 画布配置（v0.2） ====================

export interface CanvasConfig {
  /** 画布背景色（CSS 颜色值或 var(--m-*)，值来自 schema，属用户数据） */
  bgColor?: string
  /** 网格颜色 */
  gridColor?: string
  /** 网格大小(px) */
  gridSize?: number
  /** 对齐吸附步长(px)，0 关闭，缺省 10 */
  snap?: number
  /** 自由画布宽(px) */
  width?: number
  /** 自由画布高(px) */
  height?: number
}

// ==================== 页面全局过滤器（v0.2） ====================

export interface PageFilter {
  key: string
  label: string
  type: 'date' | 'number' | 'text' | 'select'
  /** select 类型的候选 */
  options?: { label: string; value: string }[]
  /** 默认值 */
  defaultValue?: string
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
