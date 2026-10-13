# Morya Studio — 数据驱动可视化平台 · 设计开发文档

> **版本**：v0.1 · **状态**：Draft · **最后更新**：2026-10-13
>
> 本文是 Morya Studio 的单一事实源（Single Source of Truth）。
> 所有架构决策、模块边界、数据契约、路线图以本文为准。
> UI 实现细节另见根目录 `DESIGN.md`（Morya UI 设计系统契约）。

---

## 目录

1. [产品概述](#1-产品概述)
2. [目标用户与使用场景](#2-目标用户与使用场景)
3. [核心概念模型](#3-核心概念模型)
4. [整体架构](#4-整体架构)
5. [Schema DSL 规范](#5-schema-dsl-规范)
6. [数据层设计](#6-数据层设计)
7. [渲染引擎设计](#7-渲染引擎设计)
8. [低代码编辑器设计](#8-低代码编辑器设计)
9. [目录结构与模块划分](#9-目录结构与模块划分)
10. [路由与导航](#10-路由与导航)
11. [状态管理](#11-状态管理)
12. [视觉风格规范](#12-视觉风格规范)
13. [主题与国际化](#13-主题与国际化)
14. [持久化与分享](#14-持久化与分享)
15. [权限与协作（远期）](#15-权限与协作远期)
16. [非功能性要求](#16-非功能性要求)
17. [开发路线图](#17-开发路线图)
18. [技术债务与已知限制](#18-技术债务与已知限制)
19. [附录：术语表](#19-附录术语表)

---

## 1. 产品概述

### 1.1 一句话定义

**Morya Studio 是一个"数据驱动生成可视化页面"的低代码平台**：用户通过配置（而非编写页面代码）把多来源数据绑定到图表 / 指标卡 / 表格 / 列表等组件，自动组装成可分享的数据看板。

### 1.2 产品定位

| 维度 | 定位 | 不做 |
| --- | --- | --- |
| 产品形态 | 低代码 Dashboard 搭建平台 | 通用 BI 分析（不做事前数据建模）、类 Tableau 的拖拽探索分析 |
| 技术底座 | Schema 驱动的渲染引擎 + 可视化编辑器 | 自研图表库（直接用 ECharts）、自研 UI 库（用 `morya-ui`） |
| 数据接入 | 多数据源适配（API / 静态 / Mock / 未来 WS/SQL） | 数据仓库、ETL、数据清洗管道 |
| 目标产出 | 可分享、可嵌入的可视化页面 | 像素级自由画布（如 Figma） |

### 1.3 与现有竞品的关系

- 借鉴 **LowCode Engine / Amis** 的 Schema 驱动思路，但聚焦于"数据可视化看板"这一垂直场景，而非通用表单/页面。
- 借鉴 **Grafana** 的"Panel + DataSource"抽象，但面向业务运营人员而非运维/开发者。
- 与 **morya-ui** 组件库共生：它是 UI 原语的唯一来源，Studio 不在组件库外自造交互。

### 1.4 成功度量（North Star）

| 指标 | 定义 | 目标（MVP 后 3 个月） |
| --- | --- | --- |
| 看板搭建时长 | 从空白页到可分享看板的中位时长 | ≤ 15 分钟 |
| 配置成功率 | Schema 无校验错误且成功渲染的比例 | ≥ 95% |
| 数据源接入数 | 支持的数据源类型数 | ≥ 3（API / 静态 / Mock） |
| 模板复用率 | 新建看板中从模板创建的比例 | ≥ 40% |

---

## 2. 目标用户与使用场景

### 2.1 用户画像

| 角色 | 描述 | 核心诉求 | 技术熟练度 |
| --- | --- | --- | --- |
| **运营/业务人员** | 需要快速搭一个周报/活动看板 | 不写代码，拖拽配置 | 低 |
| **前端开发者** | 为业务方交付数据看板 | 用 Schema 批量生成，不重复写页面 | 高 |
| **数据分析师** | 把查询结果可视化分享 | 粘贴 SQL/API 就出图 | 中 |

### 2.2 核心使用场景（User Story）

**US-1（MVP 主路径）**：运营人员新建看板 → 从模板库选"SaaS 指标看板" → 替换数据源为自己的 API → 调整图表类型和配色 → 保存 → 生成分享链接。

**US-2**：开发者手写 PageSchema JSON → 粘贴到编辑器（或导入）→ 预览渲染 → 微调样式 → 发布。

**US-3**：分析师配置一个 API 数据源（含轮询）→ 绑定折线图 → 开启"实时刷新" → 嵌入到内部系统 iframe。

### 2.3 非目标场景（Out of Scope）

- ❌ 自由画布拖拽（任意坐标摆放元素）— MVP 采用栅格布局
- ❌ 复杂数据建模（多表 join、指标口径管理）
- ❌ 大屏可视化（炫酷动效、3D）— 可作为远期方向
- ❌ 多端适配（移动端 H5 编辑器）— MVP 仅桌面端

---

## 3. 核心概念模型

系统的领域模型只有 6 个核心实体，全部围绕 **Page → Card → DataSource** 三级展开：

```
┌─────────────────────────────────────────────────────────┐
│  Project（项目/工作区）                                   │
│  ├── Page（页面，一个看板 = 一个 PageSchema）             │
│  │    ├── Card（卡片，页面上的一块内容）                  │
│  │    │    ├── type: stat | chart | table | list | ...  │
│  │    │    ├── dataSourceId ──────────┐                  │
│  │    │    └── 类型专属 config        │                  │
│  │    └── layout: grid 栅格配置       │                  │
│  └── DataSource（数据源，可被多个 Card 复用）◄────────────┘
│       └── type: api | static | mock | websocket | sql
└─────────────────────────────────────────────────────────┘
```

| 实体 | 职责 | 存储形式 |
| --- | --- | --- |
| **Project** | 一组 Page 的集合，对应一个工作区 | 后端表 / 本地 JSON |
| **Page** | 一个可独立访问、可分享的看板页面 | `PageSchema` JSON |
| **Card** | 页面上的最小内容单元（指标卡/图表/表格…） | `CardSchema` JSON |
| **DataSource** | 可复用的数据连接定义 | `DataSourceConfig` JSON |
| **Template** | 预置的 PageSchema 快照，供快速创建 | 内置 + 用户自定义 |
| **Theme** | 主题覆盖（品牌色、字体） | `ThemeOverride` JSON |

> **设计决策**：DataSource 从 Card 内联配置（当前实现）演进为**独立可复用实体**，是 v0.2 的关键架构变更。原因是：① 一个 API 往往喂给多个图表；② 连接凭证需要集中管理；③ 便于做数据缓存和轮询调度。

---

## 4. 整体架构

### 4.1 分层架构图

```
┌──────────────────────────────────────────────────────────────┐
│                      应用层 (Application)                     │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────────────┐   │
│  │ Editor     │  │ Viewer      │  │ Settings / Templates │   │
│  │ (低代码编辑器)│  │ (只读渲染页) │  │ (系统设置/模板库)     │   │
│  └─────┬──────┘  └──────┬──────┘  └──────────┬───────────┘   │
├────────┼────────────────┼────────────────────┼───────────────┤
│        ▼                ▼                    ▼               │
│                      引擎层 (Engine)                          │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  SchemaRenderer（Schema → Vue 组件树）                │    │
│  │  ComponentFactory（CardType → 组件映射）              │    │
│  │  SchemaValidator（契约校验）                          │    │
│  └──────────────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────────────┤
│                      数据层 (Data)                            │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌────────────┐   │
│  │DataSource│  │Transform │  │  Cache    │  │  Scheduler │   │
│  │ Adapter  │  │ Pipeline │  │ (内存/LS) │  │ (轮询/刷新)│   │
│  └──────────┘  └──────────┘  └───────────┘  └────────────┘   │
├──────────────────────────────────────────────────────────────┤
│                      UI 原语层 (morya-ui)                     │
│     MButton / MSelect / MTable / MDialog / message / ...     │
├──────────────────────────────────────────────────────────────┤
│                      基础设施层                               │
│  Vue 3 · Vite · Pinia · Vue Router · ECharts · vue-i18n      │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 数据流（运行时）

```
用户操作 / 定时器 / 路由进入
        │
        ▼
┌───────────────┐    fetch     ┌────────────────┐
│ DataSource    │ ───────────► │ 外部 API /     │
│ Adapter       │ ◄─────────── │ 静态 JSON/Mock │
└───────┬───────┘   raw data   └────────────────┘
        │
        ▼  raw rows
┌───────────────┐
│ Transform     │  filter / map / aggregate / sort
│ Pipeline      │
└───────┬───────┘
        ▼  clean rows
┌───────────────┐   Map<cardId, rows>   ┌─────────────────┐
│ DataStore     │ ────────────────────► │ SchemaRenderer  │
│ (Pinia store) │                       │ (按 CardSchema  │
└───────────────┘                       │  分发数据+配置) │
                                        └────────┬────────┘
                                                 ▼
                                    StatCard / ChartCard /
                                    TableCard / ListCard ...
```

**关键原则**：
1. **单向数据流**：DataSource → DataStore → Renderer，不允许组件反向写数据。
2. **Schema 不可变**：渲染期间 Schema 视为只读，编辑操作产生新 Schema（immer 风格的不可变更新）。
3. **数据与渲染解耦**：Card 组件只接收 `data: rows[]` 和 `config`，不关心数据来自 API 还是 Mock。

### 4.3 关键架构决策（ADR 摘要）

| 编号 | 决策 | 理由 | 备选方案（已否决） |
| --- | --- | --- | --- |
| ADR-1 | 用 JSON Schema 描述页面，而非代码生成 | 可序列化、可版本化、可 AI 生成 | 模板编译（如 Vue SFC 生成）— 无法运行时编辑 |
| ADR-2 | DataSource 独立为可复用实体 | 多卡复用、凭证集中、缓存统一 | 卡片内联（现状）— 重复配置 |
| ADR-3 | 栅格布局（12/24 列）而非自由画布 | 实现简单、响应式自然、对齐美观 | 自由拖拽 — 复杂度高、对齐困难 |
| ADR-4 | ECharts 作为唯一图表引擎 | 生态成熟、类型丰富、文档完善 | D3（太底层）、Chart.js（类型少） |
| ADR-5 | 图表用 vue-echarts 风格的 composable 封装 | 与 Schema 配置对齐，按需注册 | 全量引入 echarts — 包体积大 |
| ADR-6 | 编辑器与渲染器共享同一套 SchemaRenderer | 所见即所得，无预览/编辑两套代码 | 编辑器独立渲染 — 双倍维护成本 |

---

## 5. Schema DSL 规范

> Schema 是整个系统的"合同"。以下规范在现有 `src/types/schema.ts` 基础上演进，**v0.2 的破坏性变更用 ⚠️ 标注**。

### 5.1 PageSchema（页面）

```typescript
interface PageSchema {
  /** 页面唯一 ID，用于路由与持久化 */
  id: string
  /** 页面标题（显示在浏览器标签 + 分享页） */
  title: string
  /** 页面描述（SEO / 分享卡片） */
  description?: string
  /** 布局模式：grid 栅格 | free 自由（远期） */
  layout: 'grid' | 'free'
  /** 栅格配置，layout=grid 时生效 */
  grid?: GridConfig
  /** 页面级卡片列表 */
  cards: CardSchema[]
  /** 页面级主题覆盖（叠加在全局主题之上） */
  theme?: ThemeOverride
  /** 页面元信息 */
  meta?: {
    createdAt?: string
    updatedAt?: string
    createdBy?: string
    version?: number        // Schema 结构版本，用于迁移
  }
}

interface GridConfig {
  /** 总列数，默认 12 */
  cols?: number
  /** 卡片间距（px），默认 24，映射 --m-space-6 */
  gap?: number
  /** 行高（px），auto 表示按内容自适应 */
  rowHeight?: number | 'auto'
  /** 响应式断点：屏幕宽度小于该值时列数下降 */
  breakpoints?: {
    lg?: number   // < 1440px
    md?: number   // < 1024px
    sm?: number   // < 768px
  }
}
```

### 5.2 CardSchema（卡片）

```typescript
interface CardSchema {
  /** 卡片唯一 ID（页面内） */
  id: string
  /** 卡片类型，决定渲染组件与所需配置 */
  type: CardType
  /** 卡片标题（显示在卡片头部） */
  title?: string
  /** 副标题 */
  subtitle?: string
  /** 占据栅格列数，1~grid.cols，默认 12（整行） */
  span?: number
  /** 显式排序，越小越靠前；缺省按数组顺序 */
  order?: number
  /** 固定高度（px），缺省自适应 */
  height?: number

  /** ⚠️ v0.2：数据源引用。与内联 dataSource 二选一 */
  dataSourceId?: string
  /** 内联数据源（向后兼容，编辑器会引导迁移到 dataSourceId） */
  dataSource?: DataSourceConfig
  /** 数据转换管道（在数据到达卡片前执行） */
  transform?: TransformStep[]

  /** 类型专属配置（与 type 对应，有且仅有一个） */
  stat?: StatConfig
  chart?: ChartConfig
  table?: TableConfig
  list?: ListItemConfig
  banner?: BannerConfig

  /** 卡片操作按钮 */
  actions?: ActionConfig[]
  /** 加载态 / 空态 / 错误态文案覆盖 */
  stateText?: {
    loading?: string
    empty?: string
    error?: string
  }
}

type CardType =
  | 'stat'      // 指标卡（数值 + 趋势）
  | 'chart'     // 图表（ECharts）
  | 'table'     // 数据表格
  | 'list'      // 列表
  | 'banner'    // 横幅 / CTA
  | 'text'      // ⚠️ v0.2 新增：富文本/Markdown 卡片
  | 'custom'    // 自定义组件（逃生舱）
```

### 5.3 DataSourceConfig（数据源）

```typescript
interface DataSourceConfig {
  /** 数据源唯一 ID（项目内，供 Card 引用） */
  id: string
  /** 名称（编辑器内展示） */
  name: string
  /** 类型 */
  type: 'api' | 'static' | 'mock' | 'websocket' | 'sql'

  /** --- api 类型 --- */
  url?: string
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  /** 请求参数，支持 {{变量}} 插值（来自全局过滤器） */
  params?: Record<string, unknown>
  /** 响应数据的路径（lodash get 语法），如 "data.list" */
  dataPath?: string

  /** --- static 类型 --- */
  staticData?: Record<string, unknown>[]

  /** --- mock 类型 --- */
  mockTemplate?: string   // Mock.js 模板语法

  /** --- websocket 类型（远期） --- */
  wsUrl?: string
  wsProtocol?: string[]

  /** --- 通用 --- */
  /** 轮询间隔（ms），0 或不填表示不轮询 */
  pollInterval?: number
  /** 缓存策略 */
  cache?: {
    enabled?: boolean
    ttl?: number          // 缓存有效期 ms
    storage?: 'memory' | 'localStorage'
  }
  /** 认证（编辑器中加密存储，运行时注入 header） */
  auth?: {
    type: 'none' | 'bearer' | 'apikey' | 'basic'
    token?: string
    apiKeyName?: string
    apiKeyValue?: string
  }
}
```

### 5.4 ChartConfig（图表配置）

在现有基础上扩展：

```typescript
interface ChartConfig {
  chartType: 'bar' | 'line' | 'pie' | 'area' | 'radar' | 'scatter' | 'funnel' | 'gauge'
  /** X 轴字段（类别轴） */
  xField?: string
  /** Y 轴字段（数值轴） */
  yField?: string
  /** 系列拆分字段（多系列场景） */
  seriesField?: string
  /** 颜色调色板（映射到 --m-chart-* 系列色） */
  colors?: string[]
  smooth?: boolean
  showLegend?: boolean
  showGrid?: boolean
  showTooltip?: boolean
  /** 堆叠（bar/area） */
  stack?: boolean
  /** 双 Y 轴 */
  yAxis?: {
    title?: string
    format?: 'number' | 'currency' | 'percent'
  }
  /** 图表高度（覆盖卡片高度） */
  height?: number
  /** ECharts 原生 option 补丁（逃生舱，深度合并到最后） */
  rawOption?: Record<string, unknown>
}
```

### 5.5 TransformStep（数据转换管道）

```typescript
type TransformStep =
  | { op: 'filter'; expr: string }                    // 过滤，如 "value > 100"
  | { op: 'sort'; field: string; order?: 'asc'|'desc' }
  | { op: 'limit'; count: number }
  | { op: 'map'; expr: string }                       // 字段映射/计算
  | { op: 'groupBy'; field: string; aggs: Record<string, 'sum'|'avg'|'count'|'max'|'min'> }
  | { op: 'rename'; fields: Record<string, string> }
```

> **安全约束**：`expr` 表达式**不允许 `eval`**。采用沙箱化的表达式引擎（如 [filtrex](https://github.com/csmoore/filtrex) 或自研 mini-parser），白名单字段访问，禁止函数调用外的任意 JS。

### 5.6 Schema 校验规则

每个 Schema 在保存和渲染前必须通过 `validateSchema()`：

| 规则 | 级别 | 说明 |
| --- | --- | --- |
| `id` 全局唯一 | error | 页面内 Card id 不重复 |
| `type` 与配置块匹配 | error | `type: 'chart'` 必须有 `chart` 配置 |
| `dataSourceId` 存在 | error | 引用的数据源必须已在项目中定义 |
| `span` 在合法范围 | error | `1 ≤ span ≤ grid.cols` |
| `chart.xField/yField` 存在于数据字段 | warning | 静态检查数据源字段 |
| 表达式语法合法 | error | TransformStep 的 expr 可解析 |
| 颜色使用 token | warning | 禁止裸 hex（`check-raw-colors`） |

---

## 6. 数据层设计

### 6.1 模块划分

```
src/data/
├── adapters/
│   ├── base.ts          # DataSourceAdapter 抽象基类
│   ├── api.ts           # REST API 适配器
│   ├── static.ts        # 静态数据适配器
│   ├── mock.ts          # Mock 数据适配器
│   └── websocket.ts     # WebSocket 适配器（远期）
├── transform/
│   ├── pipeline.ts      # 转换管道执行器
│   ├── expr.ts          # 安全表达式引擎
│   └── __tests__/       # 转换逻辑单测
├── store.ts             # Pinia DataStore
├── cache.ts             # 缓存层（内存 + localStorage）
├── scheduler.ts         # 轮询调度器
└── types.ts             # 数据层类型
```

### 6.2 适配器接口

```typescript
interface DataSourceAdapter {
  /** 拉取数据，返回统一行格式 */
  fetch(config: DataSourceConfig, context?: FetchContext): Promise<Record<string, unknown>[]>
  /** 测试连接（编辑器"测试"按钮用） */
  test?(config: DataSourceConfig): Promise<{ ok: boolean; message?: string; sampleRows?: number }>
  /** 销毁（WebSocket 断开、定时器清理） */
  dispose?(): void
}

/** 注册表：type → adapter */
const adapters: Record<DataSourceType, DataSourceAdapter>
```

### 6.3 DataStore（Pinia）

```typescript
export const useDataStore = defineStore('data', () => {
  /** cardId → 数据行 */
  const cardData = ref<Map<string, Record<string, unknown>[]>>(new Map())
  /** cardId → 加载态 */
  const cardLoading = ref<Map<string, boolean>>(new Map())
  /** cardId → 错误 */
  const cardError = ref<Map<string, Error | null>>(new Map())

  /** 为某张卡片加载数据（含缓存、转换） */
  async function loadCardData(card: CardSchema, page: PageSchema): Promise<void>
  /** 刷新整个页面所有卡片 */
  async function refreshPage(page: PageSchema): Promise<void>
  /** 清理某卡片的数据与定时器 */
  function disposeCard(cardId: string): void
})
```

**关键行为**：
- 同一 `dataSourceId` 的多个卡片共享一次网络请求（请求去重，in-flight map）。
- 缓存命中时直接返回，不触发 loading。
- 错误时写入 `cardError`，卡片组件渲染错误态（带重试按钮）。

### 6.4 轮询调度器

```typescript
class PollScheduler {
  /** 每张卡片一个定时器，按 pollInterval 独立调度 */
  start(cardId: string, interval: number, task: () => Promise<void>): void
  stop(cardId: string): void
  stopAll(): void   // 页面离开时调用
  /** 页面不可见时自动暂停（document.visibilitychange） */
  private bindVisibility(): void
}
```

### 6.5 从现状到目标的演进

| 现状（`useDataSource.ts`） | 目标（Data 层） | 迁移步骤 |
| --- | --- | --- |
| 每个卡片独立 `useDataSource` | 统一 DataStore + 请求去重 | 1. 建 store，2. 逐卡片替换，3. 删除 composable |
| `fetch` 裸调用，无缓存 | 缓存层 + TTL | 新增 `cache.ts` |
| `transform` 字段是 string 未实现 | TransformStep 管道 | 实现 `pipeline.ts` |
| 无轮询 | PollScheduler | 新增 `scheduler.ts` |

---

## 7. 渲染引擎设计

### 7.1 SchemaRenderer（核心组件）

```vue
<!-- 概念示意，非最终实现 -->
<template>
  <div class="schema-renderer" :style="gridStyle">
    <template v-for="card in sortedCards" :key="card.id">
      <component
        :is="resolveComponent(card.type)"
        :schema="card"
        :data="dataStore.cardData.get(card.id) ?? []"
        :loading="dataStore.cardLoading.get(card.id) ?? false"
        :error="dataStore.cardError.get(card.id)"
        :style="getCardStyle(card)"
        @action="handleAction(card, $event)"
        @retry="dataStore.loadCardData(card, page)"
      />
    </template>
  </div>
</template>
```

**职责**：
1. 按 `grid.cols` 生成 CSS Grid 容器（`grid-template-columns: repeat(12, 1fr)`）。
2. 每张卡片计算 `grid-column: span N`。
3. 从 DataStore 订阅数据，分发给卡片组件。
4. 统一处理卡片的 loading / empty / error 三态。
5. 派发卡片 Action（跳转、下载、自定义事件）。

### 7.2 卡片组件契约

所有卡片组件必须实现统一的 `CardComponent` 接口：

```typescript
interface CardProps {
  schema: CardSchema
  data: Record<string, unknown>[]
  loading: boolean
  error: Error | null
}
interface CardEmits {
  (e: 'action', action: ActionConfig): void
  (e: 'retry'): void
}
```

内置卡片组件清单：

| 组件 | 对应 type | 底层实现 |
| --- | --- | --- |
| `StatCard` | stat | morya-ui `MCard` + 数值格式化 |
| `ChartCard` | chart | `useECharts` composable |
| `TableCard` | table | morya-ui `MTable` |
| `ListCard` | list | morya-ui `MList` / 自定义 |
| `BannerCard` | banner | morya-ui `MCard` + 渐变背景 |
| `TextCard` | text | Markdown 渲染（远期） |
| `CustomCard` | custom | 插槽 / 动态组件（逃生舱） |

### 7.3 组件注册机制（开放扩展）

```typescript
// engine/registry.ts
export interface CardRegistration {
  type: CardType
  component: Component
  /** 编辑器的配置表单 Schema（用于右侧属性面板自动生成） */
  editorSchema?: EditorFieldSchema[]
  /** 默认配置（新建卡片时填充） */
  defaultConfig: () => Partial<CardSchema>
}

export function registerCard(reg: CardRegistration): void
export function getCardComponent(type: CardType): Component | undefined
```

> **设计决策**：用注册表替代现有 `ComponentFactory` 的静态 Map，允许插件/业务方注册自定义卡片类型，同时保留内置类型。

### 7.4 三态处理（loading / empty / error）

| 状态 | 触发条件 | UI 表现 |
| --- | --- | --- |
| loading | 数据请求中 | 骨架屏（对应卡片类型的骨架） |
| empty | 请求成功但 `data.length === 0` | 空态插画 + 文案（可用 `stateText.empty` 覆盖） |
| error | 请求失败 | 错误图标 + 错误信息 + 重试按钮 |

---

## 8. 低代码编辑器设计

### 8.1 编辑器布局（三栏）

```
┌────────────────────────────────────────────────────────────────┐
│  TopBar: Logo │ 页面标题 │ 撤销/重做 │ 预览 │ 保存 │ 发布      │
├──────────┬──────────────────────────────────────┬──────────────┤
│          │                                      │              │
│  Left    │           Canvas                     │  Right       │
│  Panel   │      (SchemaRenderer 编辑态)          │  Panel       │
│          │                                      │              │
│ ┌──────┐ │  ┌─────────┐ ┌─────────┐            │ ┌──────────┐ │
│ │组件库│ │  │ Card    │ │ Card    │            │ │ 属性表单 │ │
│ ├──────┤ │  └─────────┘ └─────────┘            │ ├──────────┤ │
│ │数据源│ │  ┌───────────────────┐              │ │ 样式配置 │ │
│ ├──────┤ │  │ Card              │              │ ├──────────┤ │
│ │页面  │ │  └───────────────────┘              │ │ 数据配置 │ │
│ │大纲  │ │                                      │ └──────────┘ │
│ └──────┘ │                                      │              │
└──────────┴──────────────────────────────────────┴──────────────┘
```

### 8.2 左侧面板（组件与资源）

| Tab | 内容 | 交互 |
| --- | --- | --- |
| 组件库 | 所有已注册的 CardType，带图标和名称 | 拖拽到画布 / 点击添加到末尾 |
| 数据源 | 项目中所有 DataSource | 增删改查、"测试连接"、查看返回示例 |
| 页面大纲 | 当前页面卡片的树状列表 | 选中定位、拖拽排序、显隐切换 |

### 8.3 画布（Canvas）

- **直接复用 `SchemaRenderer`**，外加编辑态交互层：
  - 卡片 hover 显示边框 + 操作浮条（编辑 / 复制 / 删除 / 拖拽手柄）。
  - 拖拽手柄改变 `order` 或 `span`（拖右边缘调宽度）。
  - 点击卡片选中，右侧属性面板同步。
- **撤销/重做**：基于 Schema 不可变快照，用 Pinia 维护 `past[]` / `future[]` 栈（Command 模式简化版）。

### 8.4 右侧属性面板

按当前选中对象动态切换：

| 选中对象 | 面板内容 |
| --- | --- |
| 页面（无选中） | 页面标题、栅格列数、间距、主题 |
| 卡片 | 标题/副标题、span、类型专属配置（由 `editorSchema` 自动生成表单）、数据源绑定、Transform 管道编辑 |
| 数据源 | 类型切换、URL/参数、认证、轮询、缓存 |

**表单自动生成**：每种卡片类型在注册时提供 `editorSchema`，例如：

```typescript
// ChartCard 的 editorSchema 片段
[
  { field: 'chart.chartType', label: '图表类型', component: 'MSelect', options: [...] },
  { field: 'chart.xField', label: 'X 轴字段', component: 'MSelect', options: 'auto:dataFields' },
  { field: 'chart.smooth', label: '平滑曲线', component: 'MSwitch' },
]
```

`options: 'auto:dataFields'` 是特殊协议：从绑定的数据源当前数据推断字段列表。

### 8.5 编辑器核心 Store

```typescript
export const useEditorStore = defineStore('editor', () => {
  // 当前编辑的页面 Schema（不可变更新）
  const page = ref<PageSchema>()
  // 选中状态
  const selectedCardId = ref<string | null>(null)
  // 撤销/重做栈
  const past = ref<PageSchema[]>([])
  const future = ref<PageSchema[]>([])
  // 脏标记（未保存）
  const dirty = ref(false)

  // ---- actions ----
  function updateSchema(mutator: (draft: PageSchema) => void): void  // 入栈 past
  function undo(): void
  function redo(): void
  function selectCard(id: string | null): void
  function addCard(type: CardType, index?: number): void
  function removeCard(id: string): void
  function duplicateCard(id: string): void
  function moveCard(id: string, direction: 'up' | 'down'): void
  function resizeCard(id: string, span: number): void
  async function save(): Promise<void>
})
```

### 8.6 拖拽方案

| 场景 | 方案 | 理由 |
| --- | --- | --- |
| 组件库 → 画布 | HTML5 Drag & Drop + drop indicator | 原生 API 够用，不引第三方库 |
| 画布内排序 | 上浮条"上移/下移"按钮 + 大纲拖拽 | MVP 简化，后续可换 `vue-draggable-plus` |
| 调整卡片宽度 | 拖右边缘手柄，吸附到栅格列 | 自研简单实现 |

---

## 9. 目录结构与模块划分

> 目标结构（v0.2 完成后）。`★` 表示新增目录。

```
morya-studio/
├── docs/
│   └── DESIGN-DEV.md            ★ 本文档
├── src/
│   ├── main.ts
│   ├── App.vue
│   ├── navigation.ts            # 导航项（更新：新增 editor / templates）
│   ├── router/
│   │   └── index.ts             # 路由（更新）
│   ├── types/
│   │   └── schema.ts            # 核心类型（更新：见 §5）
│   ├── schemas/                 # 内置模板 Schema
│   │   ├── dashboard.ts         # 现有
│   │   └── templates/           ★ 模板库
│   ├── engine/                  # 渲染引擎
│   │   ├── factory.ts           # 现有 → 重构为 registry.ts
│   │   ├── registry.ts          ★ 卡片注册表
│   │   ├── SchemaRenderer.vue   ★ 核心渲染组件
│   │   ├── validate.ts          ★ Schema 校验
│   │   └── migrate.ts           ★ Schema 版本迁移
│   ├── data/                    ★ 数据层（见 §6）
│   │   ├── adapters/
│   │   ├── transform/
│   │   ├── store.ts
│   │   ├── cache.ts
│   │   └── scheduler.ts
│   ├── editor/                  ★ 低代码编辑器
│   │   ├── store.ts             # useEditorStore
│   │   ├── components/
│   │   │   ├── EditorCanvas.vue
│   │   │   ├── EditorLeftPanel.vue
│   │   │   ├── EditorRightPanel.vue
│   │   │   ├── EditorTopBar.vue
│   │   │   ├── CardWrapper.vue      # 编辑态卡片包装（hover 操作）
│   │   │   └── FieldRenderer.vue    # editorSchema → 表单控件
│   │   ├── panels/
│   │   │   ├── ComponentLibrary.vue
│   │   │   ├── DataSourcePanel.vue
│   │   │   ├── PageOutline.vue
│   │   │   └── PropertyForm.vue
│   │   └── composables/
│   │       ├── useUndoRedo.ts
│   │       └── useDragDrop.ts
│   ├── components/
│   │   ├── cards/               ★ 内置卡片组件（从 dashboard/ 迁移）
│   │   │   ├── StatCard.vue
│   │   │   ├── ChartCard.vue
│   │   │   ├── TableCard.vue
│   │   │   ├── ListCard.vue
│   │   │   ├── BannerCard.vue
│   │   │   └── CustomCard.vue
│   │   ├── common/              # 现有（BrandMark / SvgIcon / LocaleSwitch）
│   │   ├── dashboard/           # 现有 demo 卡片（保留作示例，逐步迁移）
│   │   └── shell/               # 现有
│   ├── composables/             # 通用 composable
│   │   ├── useECharts.ts        # 现有（增强：更多图表类型）
│   │   └── useDataSource.ts     # 现有（逐步被 data/ 取代）
│   ├── stores/                  ★ Pinia stores（除 data/editor 外）
│   │   ├── project.ts           # 项目/页面 CRUD
│   │   └── template.ts          # 模板库
│   ├── services/                ★ 后端 API 封装
│   │   ├── api.ts               # fetch 封装（拦截器、错误处理）
│   │   ├── page.ts              # 页面 CRUD API
│   │   └── datasource.ts        # 数据源测试 API
│   ├── layouts/                 # 现有（AppSidebar / AppHeader）
│   ├── views/
│   │   ├── DashboardView.vue    # 现有 demo
│   │   ├── EditorView.vue       ★ 编辑器页 /editor/:pageId
│   │   ├── ViewerView.vue       ★ 只读看板页 /view/:pageId
│   │   ├── PageListView.vue     ★ 页面列表 /pages
│   │   ├── TemplatesView.vue    ★ 模板库 /templates
│   │   ├── DataSourcesView.vue  ★ 数据源管理 /datasources
│   │   ├── LoginView.vue        # 现有
│   │   ├── SettingsView.vue     # 现有
│   │   └── PlaceholderView.vue  # 现有
│   ├── locales/
│   │   ├── en-US.ts
│   │   ├── zh-CN.ts
│   │   └── index.ts
│   └── styles/
│       └── app.css
├── apps/
│   ├── api/                     # 后端（Hono + Node，见 §13）
│   └── web/                     # （预留：未来拆分子应用）
├── public/
├── scripts/
│   └── check-raw-colors.mjs
├── DESIGN.md                    # Morya UI 设计系统契约
├── AGENTS.md
└── package.json
```

**模块依赖规则**（用 ESLint `import/no-restricted-paths` 强制）：

```
views → editor → engine → data → types
  ↓       ↓        ↓       ↓
services ─┘        ↓       ↓
components/cards ──┘       ↓
morya-ui（所有层可用）      ↓
types（所有层可用）◄────────┘
```

- `types/` 不依赖任何其他目录。
- `engine/` 不依赖 `editor/` 和 `views/`（保证渲染器独立可复用）。
- `data/` 不依赖 `engine/` 和 `editor/`（数据层可独立测试）。

---

## 10. 路由与导航

### 10.1 路由表

| 路径 | 名称 | 组件 | 说明 | 权限 |
| --- | --- | --- | --- | --- |
| `/login` | login | LoginView | 登录 | public |
| `/` | home | → redirect `/pages` | 首页重定向 | 需登录 |
| `/pages` | pages | PageListView | 我的看板列表 | 需登录 |
| `/editor/:pageId` | editor | EditorView | 低代码编辑器 | 需登录 |
| `/view/:pageId` | viewer | ViewerView | 只读看板渲染 | 需登录 / 分享 token |
| `/templates` | templates | TemplatesView | 模板库 | 需登录 |
| `/datasources` | datasources | DataSourcesView | 数据源管理 | 需登录 |
| `/settings` | settings | SettingsView | 设置 | 需登录 |
| `/demo/dashboard` | demo-dashboard | DashboardView | 现有 demo 保留 | 需登录 |

### 10.2 导航更新

```typescript
// navigation.ts 更新后
export const navItems: NavItem[] = [
  { key: 'pages',       icon: 'grid',     labelKey: 'nav.pages',       to: '/pages' },
  { key: 'templates',   icon: 'layers',   labelKey: 'nav.templates',   to: '/templates' },
  { key: 'datasources', icon: 'database', labelKey: 'nav.datasources', to: '/datasources' },
  { key: 'demo',        icon: 'monitor',  labelKey: 'nav.demo',        to: '/demo/dashboard' },
  { key: 'settings',    icon: 'settings', labelKey: 'nav.settings',    to: '/settings' },
]
```

---

## 11. 状态管理

采用 **Pinia**，按领域拆分 store，每个 store 单一职责：

| Store | 职责 | 持久化 |
| --- | --- | --- |
| `useSessionStore` | 登录态、用户信息 | localStorage |
| `useProjectStore` | 当前项目、页面列表 CRUD | 后端 API |
| `useEditorStore` | 编辑器：当前 Schema、选中、撤销栈 | 内存（保存时同步后端） |
| `useDataStore` | 卡片数据缓存、加载态 | 内存 + 可选 localStorage |
| `useTemplateStore` | 模板列表 | 后端 API |
| `useAppStore` | 全局 UI 态（主题、locale、密度） | localStorage |

**数据流原则**：
- 组件不直接调 `services/api.ts`，一律通过 store action。
- 编辑器对 Schema 的所有修改走 `useEditorStore.updateSchema()`，保证可撤销。

---

## 12. 视觉风格规范

> 本章定义 Morya Studio 所有界面（含编辑器、看板渲染、卡片组件）必须遵守的视觉语言。
> **基准**：现有 demo `demos/home2.png` 所确立的「柔和 SaaS 仪表盘」风格。
> 新页面 / 新组件实现前，必须对照本章自检；任何偏离需在 PR 中说明理由。
>
> 约束优先级：本章 > `DESIGN.md` 通用契约。两者不冲突——本章是在 token 体系内的具体取值与配方。

### 12.1 风格关键词

| 关键词 | 含义 | 反面（禁止） |
| --- | --- | --- |
| **柔和** | 低对比阴影、大圆角、克制的色彩 | 硬阴影、锐利直角、高饱和撞色 |
| **通透** | 充足留白、浅灰紫页面底、白色浮层卡片 | 拥挤、整屏深色、层级不清 |
| **圆润** | 胶囊（pill）元素、圆形图标容器、平滑曲线图 | 生硬方块、尖锐折线 |
| **现代 SaaS** | 紫蓝品牌渐变、克制的点缀色 | 霓虹、赛博朋克、过度毛玻璃 |

### 12.2 色彩系统

**所有颜色必须来自 token**（`--m-*` 或下方定义的扩展 token），禁止裸 hex / rgb。

| 用途 | Token | 当前取值 | 说明 |
| --- | --- | --- | --- |
| 品牌主色 | `--m-color-primary` | `#7C6AEF` | 主操作、链接、强调数值 |
| 主色 hover | `--m-color-primary-hover` | `#6B5AE0` | |
| 主色 active | `--m-color-primary-active` | `#5A49CF` | |
| 页面背景 | `--m-color-page-bg` | `#F4F5FA` | 浅灰紫，所有页面统一 |
| 卡片/浮层底 | `--m-color-surface` | 白色 | |
| 点缀蓝 | `--m-color-accent-blue` | `#5B8DEF` | 图表系列、图标 |
| 点缀橙 | `--m-color-accent-orange` | `#F59E0B` | 警示、次强调 |
| 点缀粉 | `--m-color-accent-pink` | `#EC4899` | 支出/负向、第三强调 |
| 成功/收入 | `--m-color-success` | 沿用 morya-ui 默认 | 上涨、收入、正向 |
| 正文 | `--m-color-text` | 沿用 morya-ui 默认 | |
| 次要文字 | `--m-color-text-muted` | 沿用 morya-ui 默认 | 标签、说明、时间 |

**品牌渐变**（KPI Banner、CTA、主图表高亮专用）：

```css
--m-gradient-brand: linear-gradient(135deg, #7C6AEF 0%, #8B5CF6 100%);
--m-gradient-brand-blue: linear-gradient(135deg, #7C6AEF 0%, #5B8DEF 100%);
```

> 渐变仅用于「强调区块」（Banner、主按钮、关键图表高亮），**不用于普通卡片背景或大面积铺色**。

**图表调色板**（在 `src/styles/theme/chart.css` 定义，供 ECharts 读取）：

```css
:root {
  --m-chart-1: var(--m-color-primary);
  --m-chart-2: var(--m-color-accent-blue);
  --m-chart-3: var(--m-color-accent-orange);
  --m-chart-4: var(--m-color-accent-pink);
  --m-chart-5: var(--m-color-success);
  --m-chart-6: var(--m-color-text-muted);
}
```

### 12.3 圆角与阴影

| 用途 | Token / 取值 | 说明 |
| --- | --- | --- |
| 大卡片（面板、图表卡） | `--m-radius-lg` = `20px` | 页面主卡片统一 |
| 中圆角（按钮、输入框、小卡） | `--m-radius-md` = `12px` | |
| 小圆角（标签、徽章） | `--m-radius-sm` = `8px` | |
| 胶囊（pill） | `20px` 或全圆 `999px` | 交易项、日期 tab、趋势徽章 |
| 圆形图标容器 | `50%` | KPI 图标、头像 |

| 阴影 | Token / 取值 | 用途 |
| --- | --- | --- |
| 卡片常态 | `--m-shadow-card` = `0 1px 3px rgba(0,0,0,0.04)` | 极轻柔，近乎扁平 |
| 卡片 hover | `--m-shadow-card-hover` = `0 4px 12px rgba(0,0,0,0.08)` | 可交互卡片悬浮 |
| 渐变 Banner | `0 8px 24px rgba(124,106,239,0.25)` | 带主色染色的投影 |

> **禁止**重阴影（如 `0 10px 40px rgba(0,0,0,0.3)`）、多层叠影。阴影要"轻到几乎察觉不到"。

### 12.4 间距与布局

| 用途 | 取值 | 说明 |
| --- | --- | --- |
| 页面内容内边距 | `24px 32px` | 主内容区 |
| 卡片间距（gap） | `24px`（`--m-space-6`） | 栅格间距 |
| 卡片内边距 | `24px ~ 28px` | 卡片 header/body |
| 区块垂直节奏 | `20px ~ 24px` | 卡片内子区块间距 |
| 右侧栏宽 | `340px` | 看板辅助栏（响应式 <1280px 收起为整行） |

**栅格**：12 列，`gap: 24px`。编辑器画布、SchemaRenderer 必须复用同一套间距 token，保证编辑态 = 预览态。

### 12.5 字体与排版

| 用途 | 规格 | 说明 |
| --- | --- | --- |
| 页面主标题 | `26px / 700` | 问候语、页面名 |
| 卡片标题 | `15px ~ 17px / 700` | `--m-color-text` |
| 核心数值（KPI） | `24px / 700` | 白色（渐变卡上）或 `--m-color-primary` |
| 大余额 | `15px / 600` 主色 | |
| 正文/列表项 | `14px / 600` | |
| 辅助/标签 | `12px ~ 13px` `--m-color-text-muted` | 时间、说明、图例 |
| 字体族 | `var(--m-font-sans)` | 抗锯齿已开启 |

**数字**：货币、百分比统一用 `formatValue` 格式化；趋势用 `+5.4%` / `-7.4%` 带符号，配 pill 徽章（涨=success 浅底、跌=danger/pink 浅底）。

### 12.6 组件级配方

> 以下是已实现并确认风格正确的「样板」，新卡片应对齐。

**KPI 渐变 Banner**（`KpiBanner.vue`）：渐变底 + 白色文字 + 半透明白圆形图标底（`rgba(255,255,255,0.2)`）+ 白色 pill 趋势徽章 + 主色染色阴影。

**数据面板卡**（`TransactionsPanel.vue`）：白底 + 20px 圆角 + 极轻阴影；header 标题左 + 「查看全部」灰 pill 按钮右；内容左右分栏。

**进度/占比卡**（`ActiveMembersCard.vue`）：分段式进度条（`6px` 高、段间 `2px` 缝、圆角段），配色用图表调色板；图例用 `8px` 圆点 + 12px  muted 文字。

**图表**：坐标轴标签 `--m-color-text-muted`、分隔线 `--m-color-split`、柱子圆角 `[4,4,0,0]`、折线 `3px` 平滑；仪表盘（gauge）用品牌渐变进度 + 圆角进度帽。

### 12.7 编辑器自身的视觉

编辑器（三栏）同样遵守本章：

- 三栏背景用 `--m-color-surface`，分隔线 `--m-color-border`（`1px`）。
- 画布区背景用 `--m-color-page-bg`，与真实看板一致（所见即所得）。
- 卡片 hover 框：`2px solid var(--m-color-primary)`；选中态常显同色框 + 浅主色底（`color-mix(in srgb, var(--m-color-primary) 8%, transparent)`）。
- 拖拽指示线：`2px` 主色。
- 左/右面板的区块标题：`13px / 600` muted，与卡片标题层级区分。

### 12.8 暗色主题（远期，预留约束）

- 所有颜色必须走 token，暗色仅需覆盖 `:root`/`[data-theme="dark"]` 变量即可切换。
- 渐变 Banner 在暗色下降低亮度（覆盖 `--m-gradient-brand`）。
- **当前阶段不做暗色**，但写样式时不得硬编码"假设浅色"的颜色到组件内（一律引用 token）。

---

## 13. 主题与国际化

### 12.1 主题

- **基础**：遵守 `DESIGN.md`，所有颜色用 `--m-*` token，禁止裸 hex。
- **品牌覆盖**：通过 `ThemeOverride` 在页面级覆盖 `--m-color-primary` 等。
- **图表配色**：提供默认调色板，映射到 token：

```css
:root {
  --m-chart-1: var(--m-color-primary);
  --m-chart-2: #7C6AEF; /* 后续定义完整 chart 色阶 */
  /* ... */
}
```

> 图表的 `colors` 默认值从 CSS 变量读取（`getComputedStyle`），避免在 JS 中写死颜色。

### 12.2 国际化

- 沿用 `vue-i18n`，`zh-CN` / `en-US`。
- 编辑器 UI 文案全部走 i18n。
- Schema 中的用户内容（如卡片标题）**不做 i18n**（属于用户数据）。

---

## 14. 持久化与分享

### 13.1 存储方案

| 阶段 | 方案 | 说明 |
| --- | --- | --- |
| MVP | localStorage + JSON 导出/导入 | 无后端也能跑通编辑器全流程 |
| v0.3 | 后端 API（Hono + SQLite/MySQL） | `apps/api/` 已预留 |

### 13.2 本地持久化格式（MVP）

```json
{
  "morya-studio:pages": {
    "page-xxx": { "id": "page-xxx", "title": "...", "cards": [...] }
  },
  "morya-studio:datasources": { ... },
  "morya-studio:meta": { "version": 1 }
}
```

### 13.3 分享机制

- 生成只读链接 `/view/:pageId?token=xxx`。
- token 内含页面 ID + 签名（防篡改）。
- 分享页隐藏编辑入口，仅渲染 `SchemaRenderer` 只读态。
- 可选"嵌入代码"：`<iframe src="...">`。

### 13.4 后端 API 草案（`apps/api`，Hono）

```
GET    /api/pages              # 列表
POST   /api/pages              # 创建
GET    /api/pages/:id          # 详情（含 Schema）
PUT    /api/pages/:id          # 更新 Schema
DELETE /api/pages/:id          # 删除
POST   /api/pages/:id/publish  # 发布（生成分享 token）

GET    /api/datasources        # 数据源列表
POST   /api/datasources/test   # 测试连接（代理转发，避免 CORS）

GET    /api/templates          # 模板列表
```

---

## 15. 权限与协作（远期）

| 功能 | 描述 | 优先级 |
| --- | --- | --- |
| 多用户/团队 | 项目归属团队，成员角色（Owner / Editor / Viewer） | P2 |
| 版本历史 | 页面 Schema 每次保存生成版本，可回滚 | P2 |
| 评论 | 卡片级评论 | P3 |
| 协同编辑 | 基于 Yjs / CRDT 的实时协同 | P3 |

---

## 16. 非功能性要求

| 类别 | 要求 | 度量 |
| --- | --- | --- |
| 性能 | 首屏 LCP | < 2.5s（MVP demo 页） |
| 性能 | 单页 50 卡片渲染 | 滚动 60fps，无明显卡顿 |
| 性能 | 大数据量 | 单卡片 ≤ 10000 行（表格分页，图表降采样） |
| 包体积 | 首屏 JS（gzip） | < 500KB（ECharts 按需） |
| 可访问性 | 编辑器键盘可达 | 卡片可 Tab 选中，Esc 取消选中 |
| 浏览器 | 支持范围 | Chrome / Edge / Firefox 最近 2 个大版本 |
| 稳定性 | 渲染错误隔离 | 单卡片渲染异常不影响其他卡片（ErrorBoundary） |

---

## 17. 开发路线图

### Milestone 1 — MVP 编辑器（4 周）

**目标**：能用编辑器从无到有搭一个绑定静态/Mock 数据的看板并保存。

| 周 | 任务 | 产出 |
| --- | --- | --- |
| W1 | Schema v0.2 定型（DataSource 独立、Transform）；`validate.ts`；`migrate.ts` | 类型定义 + 校验器 + 单测 |
| W2 | Data 层：adapters（api/static/mock）、DataStore、cache；卡片组件库（Stat/Chart/Table/List/Banner 五种） | `src/data/` + `src/components/cards/` |
| W3 | 编辑器骨架：三栏布局、EditorStore、组件库拖拽添加、属性面板（基础字段） | `src/editor/` |
| W4 | 撤销/重做、本地持久化（localStorage）、导入/导出 JSON、只读 Viewer 页 | 完整 MVP |

**验收标准**：
- 从模板创建 → 修改数据源 → 保存 → 刷新页面后恢复 → 分享链接可看。
- `validate_page` 契约通过；`pnpm check:colors` 无违规。

### Milestone 2 — 数据源与图表增强（3 周）

| 周 | 任务 |
| --- | --- |
| W5 | API 数据源：认证、dataPath、参数插值；数据源管理页 |
| W6 | Transform 管道（filter/sort/limit/groupBy）；表达式引擎 |
| W7 | 图表类型扩展（area/radar/scatter/funnel/gauge）；rawOption 逃生舱 |

### Milestone 3 — 模板库与分享（2 周）

| 周 | 任务 |
| --- | --- |
| W8 | 模板库页（内置 5+ 模板）；从模板创建；自定义模板保存 |
| W9 | 分享链接 + token；嵌入 iframe；页面列表页完善 |

### Milestone 4 — 后端与协作基础（3 周）

| 周 | 任务 |
| --- | --- |
| W10 | `apps/api` Hono 服务：pages / datasources / templates CRUD |
| W11 | 前端切换到后端存储；数据源测试代理 |
| W12 | 版本历史（保存快照 + 回滚） |

### 远期 Backlog

- WebSocket / SQL 数据源
- 全局过滤器（页面级时间范围选择器，参数注入到所有卡片）
- 大屏模式（自由画布、深色背景）
- AI 辅助生成 Schema（自然语言 → PageSchema）
- 协同编辑

---

## 18. 技术债务与已知限制

| 项目 | 现状 | 影响 | 计划 |
| --- | --- | --- | --- |
| `apps/api` 仅有 node_modules | 无 package.json / 源码 | 无法启动后端 | M4 补齐 |
| `apps/web` 仅有 node_modules | 同上 | 目录预留 | 后续明确 monorepo 拆分策略 |
| `ComponentFactory` 静态 Map | 不支持扩展 | 自定义卡片受限 | M1 重构为注册表 |
| `useDataSource` 内联在卡片 | 无复用、无缓存 | 重复请求 | M1-W2 迁入 Data 层 |
| `useECharts` 硬编码颜色 | `#9CA3AF` 等裸色 | 违反 token 规范 | 改为读 CSS 变量 |
| ECharts 仅注册 bar/line/pie | 类型不全 | 图表类型少 | M2 扩展 |
| Schema 无版本号 | 无法迁移 | 破坏性变更难推进 | M1 加 `meta.version` |
| `pnpm-lock.yaml` 有未提交修改 | 依赖状态不一致 | CI/协作风险 | 立即提交或回滚 |

---

## 19. 附录：术语表

| 术语 | 英文 | 定义 |
| --- | --- | --- |
| Schema | — | 描述页面结构与数据绑定的 JSON 对象 |
| 卡片 | Card | 页面上的最小内容单元（图表/指标/表格…） |
| 数据源 | DataSource | 数据的来源定义（API/静态/Mock…），可复用 |
| 转换管道 | Transform Pipeline | 数据到达卡片前的处理步骤链 |
| 渲染引擎 | Schema Renderer | 把 Schema 翻译成 Vue 组件树的运行时 |
| 编辑器 | Editor | 可视化编辑 Schema 的三栏工作台 |
| 模板 | Template | 预置的 PageSchema 快照 |
| 卡片注册表 | Card Registry | 卡片类型 → 组件 + 编辑器表单的映射 |
| 栅格 | Grid | 12/24 列的响应式布局系统 |
| 逃生舱 | Escape Hatch | `custom` 卡片 / `rawOption`，允许绕过 Schema 直接写代码 |

---

> **文档维护**：本文档随架构演进而更新。重大变更需在 PR 中同步修订对应章节，并在 `DESIGN-DEV.md` 头部更新版本号与日期。
