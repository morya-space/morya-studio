/**
 * Morya Studio 核心类型定义
 * 行业无关的数据驱动可视化页面生成系统
 *
 * 契约见 docs/DESIGN-DEV.md §5 Schema DSL 规范。
 * 标注 `v0.2` 的字段为本轮 Schema 升级新增；旧字段保留以向后兼容。
 */

/** 当前 Schema 结构版本，用于 migrate（见 src/engine/migrate.ts） */
export const SCHEMA_VERSION = 3

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

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type RequestBodyType = 'none' | 'json' | 'form' | 'x-www-form-urlencoded'

export interface DataSourceConfig {
  /** v0.2：数据源唯一 ID（项目内，供 Card.dataSourceId 引用）。内联数据源可省略 */
  id?: string
  /** v0.2：名称（编辑器内展示） */
  name?: string
  type: DataSourceType
  url?: string
  /** v0.3：请求方法扩展 GET/POST/PUT/PATCH/DELETE */
  method?: HttpMethod
  headers?: Record<string, string>
  params?: Record<string, unknown>
  /** v0.3：请求体类型 */
  bodyType?: RequestBodyType
  /** v0.3：请求体（json/form 字符串） */
  body?: string
  /** v0.4：请求超时（ms） */
  timeoutMs?: number
  /** v0.4：失败重试 */
  retry?: { count: number; delayMs: number }
  /** v0.4：WebSocket 订阅配置 */
  ws?: { messagePath?: string; aggregate?: 'first' | 'append' | 'replace' }
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

// ==================== 计算列（v0.5） ====================

export interface ComputedField {
  /** 新字段名（不能与已有字段重名） */
  name: string
  /** 表达式（行上下文，如 row.revenue - row.cost） */
  expr: string
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
  /** 单字段或多字段（多度量时生成多个 series） */
  yField?: string | string[]
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
  /** v0.3：饼图环形 */
  donut?: boolean
  /** v0.3：显示数值标签 */
  labelShow?: boolean
  /** v0.3：仪表盘最大值 */
  max?: number
  /** v0.3：柱线混合图的折线字段 */
  subField?: string
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
  // 图表（共享 ChartConfig，chartType 固定）
  | 'chart'
  | 'bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'scatter'
  | 'radar'
  | 'funnel'
  | 'gauge'
  | 'barH'
  | 'barLine'
  | 'sankey'
  | 'graph'
  | 'heatmap'
  | 'treeMap'
  | 'wordCloud'
  | 'waterPolo'
  // 数据卡
  | 'stat'
  | 'table'
  | 'list'
  // 信息卡
  | 'text'
  | 'banner'
  | 'number'
  | 'time'
  | 'countdown'
  | 'textGradient'
  | 'barrage'
  | 'carousel'
  | 'formInput'
  | 'formSelect'
  | 'formTabs'
  | 'pagination'
  // 媒体
  | 'image'
  | 'video'
  | 'iframe'
  // 表格（滚动）
  | 'scrollTable'
  // 装饰
  | 'icon'
  | 'border'
  | 'decoration'
  | 'circlePoint'
  | 'pipeline'
  | 'flowLine'
  | 'clock'
  | 'fullScreen'
  | 'earth3D'
  // 逃生舱
  | 'custom'

export interface CardStateText {
  loading?: string
  empty?: string
  error?: string
}

// ==================== 卡片样式 / 状态 / 事件（v0.3） ====================

/** 卡片外观样式（大屏/自由布局常用），取值均为用户数据 */
export interface CardStyles {
  /** 透明度 0~1 */
  opacity?: number
  /** 滤镜：色相旋转（deg） */
  hueRotate?: number
  /** 滤镜：饱和度 */
  saturate?: number
  /** 滤镜：对比度 */
  contrast?: number
  /** 滤镜：亮度 */
  brightness?: number
  /** 旋转（deg） */
  rotateZ?: number
  /** 斜切 X（deg） */
  skewX?: number
  /** 斜切 Y（deg） */
  skewY?: number
  /** CSS mix-blend-mode */
  blendMode?: string
  /** 入场动画（animate.css 类名），最多取第一个 */
  animations?: string[]
}

/** 卡片状态：锁定（不可拖动）/ 隐藏 */
export interface CardStatus {
  lock?: boolean
  hide?: boolean
}

export type BaseEventName = 'click' | 'dblclick' | 'mouseenter' | 'mouseleave'

/** 交互联动：把源组件 emit 的载荷映射到目标卡片数据源参数 */
export interface InteractBinding {
  /** 目标参数名（写入目标数据源 params / header 的 key） */
  target: string
  /** 源载荷取值路径，如 "data.name" */
  source: string
}

export interface InteractEvent {
  id: string
  /** 触发时机：源组件抛出的事件名（见 CardRegistration.emitEvents） */
  on: string
  /** 目标卡片 id */
  targetCardId: string
  bindings: InteractBinding[]
  enabled?: boolean
}

export interface CardEvents {
  /** 基础事件（点击/双击/移入/移出）→ 复用声明式 ActionConfig */
  base?: Partial<Record<BaseEventName, ActionConfig[]>>
  /** 组件联动 */
  interactions?: InteractEvent[]
}

/** 卡片分组（卡片保持扁平，用 groupId 引用） */
export interface CardGroup {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
  locked?: boolean
  hidden?: boolean
  order?: number
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
  /** 计算列：在原始字段之上用表达式派生新字段，先于 transform 执行 */
  computedFields?: ComputedField[]

  chart?: ChartConfig
  stat?: StatConfig
  table?: TableConfig
  list?: ListItemConfig
  banner?: BannerConfig
  text?: TextConfig
  custom?: CustomConfig
  /** v0.3：数字计数 */
  number?: NumberConfig
  /** v0.3：时间 */
  time?: TimeConfig
  /** v0.3：倒计时 */
  countdown?: CountdownConfig
  /** v0.3：图片 */
  image?: ImageConfig
  /** v0.3：视频 */
  video?: VideoConfig
  /** v0.3：内嵌网页 */
  iframe?: IframeConfig
  /** v0.3：滚动表格 */
  scrollTable?: ScrollTableConfig
  /** v0.3：图标 */
  icon?: IconConfig
  /** v0.3：装饰（边框/线条） */
  decorate?: DecorateConfig
  /** v0.3：时钟 */
  clock?: ClockConfig
  /** v0.3：全屏按钮 */
  fullScreen?: FullScreenConfig
  /** v0.3：跑马灯 */
  barrage?: BarrageConfig
  /** v0.3：轮播 */
  carousel?: CarouselConfig
  /** v0.3：表单输入 */
  formInput?: FormInputConfig
  /** v0.3：表单下拉 */
  formSelect?: FormSelectConfig
  /** v0.3：表单页签 */
  formTabs?: FormTabsConfig
  /** v0.3：分页 */
  pagination?: PaginationConfig
  /** v0.3：词云 */
  wordCloud?: WordCloudConfig
  /** v0.3：水球 */
  waterPolo?: WaterPoloConfig
  /** v0.3：3D 地球 */
  earth3D?: Earth3DConfig

  actions?: ActionConfig[]
  /** v0.2：加载/空/错误三态文案覆盖 */
  stateText?: CardStateText

  /** v0.3：外观样式 */
  styles?: CardStyles
  /** v0.3：锁定 / 隐藏 */
  status?: CardStatus
  /** v0.3：事件与联动 */
  events?: CardEvents
  /** v0.3：渲染细节（内容溢出裁剪等） */
  preview?: { overflowHidden?: boolean }
  /** v0.3：所属分组 id（分组信息存 PageSchema.groups） */
  groupId?: string
}

// ==================== 文本 / 自定义卡片（v0.2） ====================

export interface TextConfig {
  /** 文本内容（纯文本或轻量 Markdown） */
  content?: string
  /** 按轻量 Markdown 渲染（标题/粗体/斜体/链接/列表/行内代码） */
  markdown?: boolean
  /** v0.3：字号(px) */
  fontSize?: number
  /** v0.3：文字颜色（默认 token） */
  color?: string
  /** v0.3：水平对齐 */
  align?: 'left' | 'center' | 'right'
  /** v0.3：字重 */
  fontWeight?: 'normal' | 'bold'
  /** v0.3：字间距(px) */
  letterSpacing?: number
  /** v0.3：背景色 */
  backgroundColor?: string
  /** v0.3：边框 */
  borderWidth?: number
  borderColor?: string
  borderRadius?: number
  /** v0.3：整块跳转链接 */
  link?: string
  /** v0.3：渐变文字（标题渐变色） */
  gradient?: boolean
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

// ==================== 信息 / 媒体 / 装饰 组件（v0.3） ====================
// 对齐 go-view 的 Informations / Mores / Decorates 分类；颜色默认走 --m-* token。

/** 数字计数（对齐 go-view Number） */
export interface NumberConfig {
  /** 数据字段（绑定数据源时取该字段） */
  valueField?: string
  /** 静态数值（未绑定数据源时使用） */
  value?: number
  /** 动画起始值 */
  from?: number
  /** 动画时长（秒） */
  duration?: number
  precision?: number
  /** 千分位分隔 */
  separator?: boolean
  fontSize?: number
  color?: string
  prefix?: string
  suffix?: string
}

/** 时间（对齐 go-view TimeCommon） */
export interface TimeConfig {
  /** 格式，如 YYYY-MM-DD HH:mm:ss */
  format?: string
  fontSize?: number
  color?: string
  bold?: boolean
}

/** 倒计时（对齐 go-view CountDown） */
export interface CountdownConfig {
  /** 目标时间（ISO 字符串） */
  target?: string
  format?: string
  fontSize?: number
  color?: string
}

/** 图片（对齐 go-view Image） */
export interface ImageConfig {
  url?: string
  fit?: 'contain' | 'cover' | 'fill' | 'none'
  radius?: number
}

/** 视频（对齐 go-view Video） */
export interface VideoConfig {
  url?: string
  fit?: 'contain' | 'cover' | 'fill'
  muted?: boolean
  loop?: boolean
  autoplay?: boolean
  controls?: boolean
}

/** 内嵌网页（对齐 go-view Iframe） */
export interface IframeConfig {
  url?: string
  title?: string
}

/** 滚动表格（对齐 go-view TableScrollBoard） */
export interface ScrollTableConfig {
  columns?: TableColumn[]
  rowHeight?: number
  /** 滚动速度（px/s），0 = 不滚动 */
  speed?: number
  headShow?: boolean
  indexShow?: boolean
  stripe?: boolean
}

/** 图标（对齐 go-view Icon） */
export interface IconConfig {
  /** 内置图标名（见 src/assets/icons） */
  name?: string
  size?: number
  color?: string
}

/** 装饰（边框 / 线条 / 标题框，对齐 go-view Borders / Decorates） */
export interface DecorateConfig {
  /** 变体：
   * border01..border13 / line-h / line-v / title / box / corner
   * circle / pipeline-h / pipeline-v / flow（Mores） */
  variant?: string
  title?: string
  color?: string
  background?: string
}

/** 时钟（对齐 go-view Clock） */
export interface ClockConfig {
  mode?: 'digital' | 'analog'
  /** digital 格式 */
  format?: string
  fontSize?: number
  color?: string
}

/** 全屏按钮（对齐 go-view FullScreen） */
export interface FullScreenConfig {
  text?: string
  color?: string
}

/** 跑马灯文字（对齐 go-view TextBarrage） */
export interface BarrageConfig {
  text?: string
  /** 滚动速度（px/s） */
  speed?: number
  fontSize?: number
  color?: string
}

/** 轮播（对齐 go-view ImageCarousel） */
export interface CarouselConfig {
  urls?: string[]
  /** 切换间隔（秒） */
  interval?: number
  radius?: number
}

/** 表单输入（对齐 go-view InputsInput） */
export interface FormInputConfig {
  label?: string
  placeholder?: string
  /** 参与页面参数注入的变量名 */
  modelKey?: string
}

/** 表单下拉（对齐 go-view InputsSelect） */
export interface FormSelectConfig {
  label?: string
  placeholder?: string
  options?: { label: string; value: string }[]
  modelKey?: string
}

/** 表单选项页签（对齐 go-view InputsTab） */
export interface FormTabsConfig {
  tabs?: string[]
  modelKey?: string
}

/** 分页（对齐 go-view InputsPagination） */
export interface PaginationConfig {
  total?: number
  pageSize?: number
  modelKey?: string
}

/** 词云（对齐 go-view WordCloud） */
export interface WordCloudConfig {
  textField?: string
  valueField?: string
  color?: string
  minSize?: number
  maxSize?: number
}

/** 水球（对齐 go-view WaterPolo） */
export interface WaterPoloConfig {
  valueField?: string
  value?: number
  max?: number
  color?: string
  precision?: number
}

/** 3D 地球（对齐 go-view ThreeEarth01） */
export interface Earth3DConfig {
  color?: string
  /** 自转速度 */
  speed?: number
  autoRotate?: boolean
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
  /** v0.3：页面形态：dashboard（栅格看板）/ screen（自由大屏） */
  mode?: 'dashboard' | 'screen'
  grid?: GridConfig
  cards: CardSchema[]
  /** v0.3：卡片分组集合 */
  groups?: CardGroup[]
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
  /** v0.3：背景图（URL 或 dataURL） */
  backgroundImage?: string
  /** v0.3：预览/大屏缩放策略，缺省 fit */
  scaleType?: 'fit' | 'scrollX' | 'scrollY' | 'full'
  /** v0.3：画布主题，大屏缺省 dark */
  theme?: 'light' | 'dark'
  /** v0.3：选中框颜色（缺省用 --m-color-primary） */
  selectColor?: string
  /** v0.3：画布级滤镜（与卡片 styles 同构，仅取滤镜字段） */
  filter?: CardStyles
  /** v0.4：画布水印 */
  watermark?: { show?: boolean; text?: string }
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
