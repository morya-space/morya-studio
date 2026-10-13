# Morya Studio — 分步执行方案

> **配套文档**：架构与契约见 `docs/DESIGN-DEV.md`。本文只做"怎么做"，不讲"为什么"。
>
> **使用方式**：从上往下按 Phase 执行。每步包含：**目标 → 操作（含文件路径与代码要点）→ 验收（可运行命令 / 人工检查点）→ 预估工时**。
>
> **前置约定**：
> - 所有 UI 用 `morya-ui` 的 `M*` 组件，样式用 `--m-*` token，禁止裸 hex（每 Phase 结束跑 `pnpm check:colors`）。
> - **视觉风格必须对齐 `docs/DESIGN-DEV.md` 第 12 章「视觉风格规范」**（基准：`demos/home2.png` 的柔和 SaaS 仪表盘风）。新卡片/页面实现前对照 §12.6 样板自检。
> - 每完成一个 Phase 提交一次 commit（建议 commit message 用 `feat(phase-N): ...`）。
> - 步骤标注 `[可并行]` 表示可与同 Phase 其他步骤并行；`[阻塞]` 表示后续步骤依赖它。

---

## Phase 0 — 环境清理与基线对齐（0.5 天）

### 0.1 处理未提交的依赖变更 `[阻塞]`

**目标**：让 `pnpm-lock.yaml` 处于干净状态。

```bash
git status                        # 确认只有 pnpm-lock.yaml 变更
git diff pnpm-lock.yaml           # 查看变更内容
# 二选一：
git checkout -- pnpm-lock.yaml    # A. 回滚（若不确定变更来源）
git add pnpm-lock.yaml && git commit -m "chore: update lockfile"   # B. 提交（若是自己安装依赖导致）
```

**验收**：`git status` 输出 `nothing to commit, working tree clean`。

### 0.2 清理空壳 apps 目录 `[阻塞]`

**目标**：`apps/api` 和 `apps/web` 当前只有 `node_modules`，没有 `package.json`，会误导后续开发。

```bash
# 检查确认（应只输出 node_modules）
cmd /c "dir /b apps\api"
cmd /c "dir /b apps\web"
```

**操作（二选一）**：

- **方案 A（推荐）**：暂时删除，M4 重建时从零搭建干净的 Hono 项目：
  ```bash
  cmd /c "rmdir /s /q apps\api\node_modules apps\web\node_modules"
  cmd /c "rmdir /s /q apps\api apps\web"
  # 保留空的 apps/ 目录占位，加 .gitkeep
  ```
  新建 `apps/.gitkeep`（空文件），提交。

- **方案 B**：保留但加说明：在 `apps/` 下建 `README.md` 写明"预留目录，见 docs/DESIGN-DEV.md §13.4"。

**验收**：`apps/` 下不再有游离的 `node_modules`；`git status` 干净。

### 0.3 建立开发分支与基线

```bash
git checkout -b feat/lowcode-mvp
pnpm install          # 确保依赖一致
pnpm dev              # 确认现有 demo 能跑（浏览器打开提示的端口）
pnpm check:colors     # 记录当前基线（现有违规可暂不修，列入债）
```

**验收**：dev 服务器正常启动，能看到现有 dashboard demo；`check:colors` 的违规清单已记录（作为后续偿还依据）。

### 0.4 补全 package.json 脚本

在 `package.json` 的 `scripts` 中补充（为后续做准备）：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview",
    "check:colors": "node scripts/check-raw-colors.mjs",
    "typecheck": "vue-tsc --noEmit",
    "test": "vitest"
  }
}
```

并安装 vitest（单测用）：
```bash
pnpm add -D vitest @vue/test-utils jsdom
```

**验收**：`pnpm typecheck` 通过（现有代码应无类型错误）；`pnpm test` 能运行（即使暂无测试）。

### 0.5 落地样式基线 token `[阻塞]`

**目标**：把 `DESIGN-DEV.md` §12 定义的扩展 token 写进 CSS，让后续所有组件直接引用，避免再次散落裸色。

**操作**：

1. 新建 `src/styles/theme/brand.css`（`theme/` 目录在 `check-raw-colors` 忽略名单内，允许 hex 种子值）：
   ```css
   /* 品牌渐变与图表调色板 —— 风格基准见 docs/DESIGN-DEV.md §12 */
   :root {
     --m-gradient-brand: linear-gradient(135deg, #7C6AEF 0%, #8B5CF6 100%);
     --m-gradient-brand-blue: linear-gradient(135deg, #7C6AEF 0%, #5B8DEF 100%);
     --m-shadow-banner: 0 8px 24px rgba(124, 106, 239, 0.25);
   }
   ```

2. 新建 `src/styles/theme/chart.css`：
   ```css
   :root {
     --m-chart-1: var(--m-color-primary);
     --m-chart-2: var(--m-color-accent-blue);
     --m-chart-3: var(--m-color-accent-orange);
     --m-chart-4: var(--m-color-accent-pink);
     --m-chart-5: var(--m-color-success, #10b981);
     --m-chart-6: var(--m-color-text-muted);
   }
   ```

3. 在 `src/styles/app.css` 顶部 `@import './theme/brand.css';` 和 `@import './theme/chart.css';`。

**验收**：`pnpm dev` 后页面样式无回归；`pnpm check:colors` 通过（theme/ 下 hex 被忽略）。

---

## Phase 1 — Schema v0.2 类型与校验（2 天）

> 产出物：升级后的 `src/types/schema.ts` + 全新的 `src/engine/validate.ts` 与单测。

### 1.1 升级核心类型 `[阻塞]`

**文件**：`src/types/schema.ts`

**操作**：在现有类型基础上做如下**扩展**（保留现有导出，新增的在注释中标 `v0.2`）：

1. **DataSourceConfig** 扩展（对照 DESIGN-DEV §5.3）：
   - 新增字段：`id: string`、`name: string`、`dataPath?: string`、`headers?: Record<string, string>`、`pollInterval?: number`、`cache?: { enabled?: boolean; ttl?: number; storage?: 'memory' | 'localStorage' }`、`auth?: {...}`。
   - `type` 联合类型扩展为 `'api' | 'static' | 'mock' | 'websocket' | 'sql'`。

2. **CardSchema** 扩展：
   - 新增 `dataSourceId?: string`（与现有 `dataSource` 并存，标注"`dataSource` 将在 v0.3 移除"）。
   - 新增 `transform?: TransformStep[]`、`height?: number`、`stateText?: { loading?: string; empty?: string; error?: string }`。
   - `CardType` 增加 `'text'`。

3. **新增 TransformStep**（对照 DESIGN-DEV §5.5）：
   ```typescript
   export type TransformStep =
     | { op: 'filter'; expr: string }
     | { op: 'sort'; field: string; order?: 'asc' | 'desc' }
     | { op: 'limit'; count: number }
     | { op: 'map'; expr: string }
     | { op: 'groupBy'; field: string; aggs: Record<string, 'sum' | 'avg' | 'count' | 'max' | 'min'> }
     | { op: 'rename'; fields: Record<string, string> }
   ```

4. **ChartConfig** 扩展：`chartType` 增加 `'funnel' | 'gauge'`；新增 `stack?: boolean`、`yAxis?: { title?: string; format?: 'number' | 'currency' | 'percent' }`、`rawOption?: Record<string, unknown>`。

5. **PageSchema.meta** 增加 `version?: number`，导出常量 `export const SCHEMA_VERSION = 2`。

**验收**：`pnpm typecheck` 通过；现有 `src/schemas/dashboard.ts` 仍能编译（可能需要给 `dataSource` 补 `id`/`name`，或在类型里保持 `id`/`name` 可选并标注"内联数据源暂可省略"）。

### 1.2 实现 Schema 校验器 `[阻塞]`

**文件**：`src/engine/validate.ts`（新建）

**操作**：实现以下导出函数：

```typescript
import type { PageSchema, CardSchema } from '../types/schema'

export interface ValidationIssue {
  level: 'error' | 'warning'
  path: string        // 如 "cards[2].chart.xField"
  message: string
}

export function validatePage(
  schema: PageSchema,
  knownDataSourceIds: Set<string>,
): { valid: boolean; issues: ValidationIssue[] }
```

**校验规则清单**（逐条实现，对照 DESIGN-DEV §5.6）：

| # | 规则 | 级别 | 实现要点 |
|---|---|---|---|
| R1 | 页面内 Card `id` 不重复 | error | 用 `Set` 收集重复项 |
| R2 | `type` 与配置块匹配（chart→chart、stat→stat…） | error | 按 type switch 检查对应字段存在 |
| R3 | `dataSourceId` 引用的数据源已定义 | error | 查 `knownDataSourceIds`；与内联 `dataSource` 二选一（两者都缺报 error） |
| R4 | `1 ≤ span ≤ grid.cols` | error | 默认 cols=12 |
| R5 | `chart.xField/yField` 在静态数据字段中存在 | warning | 仅当 `staticData` 可推断时检查 |
| R6 | `transform` 各步骤 `op` 合法、`expr` 可解析 | error | 表达式解析依赖 1.3，先留 TODO 用 try/catch 占位 |
| R7 | 卡片 `order` 建议无重复 | warning | 收集重复 order |

**单测**：`src/engine/__tests__/validate.test.ts`，每条规则至少 1 个正例 + 1 个反例。

**验收**：`pnpm test validate` 全绿；`pnpm typecheck` 通过。

### 1.3 实现安全表达式引擎 `[可并行]`

**文件**：`src/data/transform/expr.ts`（新建，先在数据层占位）

**操作**：
1. 安装表达式库：`pnpm add filtrex`（或自研，见 DESIGN-DEV §5.5 安全约束）。
2. 封装：
   ```typescript
   export function compileExpr(expr: string): (row: Record<string, unknown>) => unknown
   export function validateExpr(expr: string): { ok: boolean; error?: string }
   ```
3. 单测覆盖：字段访问、比较、算术、逻辑运算；**禁止** `process`、`require`、`global` 等危险标识符（写反例测试）。

**验收**：危险表达式（如 `process.exit()`）在单测中被拒绝；`pnpm test expr` 通过。

### 1.4 实现 Transform 管道执行器

**文件**：`src/data/transform/pipeline.ts`（新建）

**操作**：
```typescript
import type { TransformStep } from '../../types/schema'

export function applyTransform(
  rows: Record<string, unknown>[],
  steps: TransformStep[] = [],
): Record<string, unknown>[] {
  return steps.reduce((acc, step) => {
    switch (step.op) {
      case 'filter': /* compileExpr 过滤 */
      case 'sort':   /* 按 field 排序 */
      case 'limit':  /* slice */
      case 'map':    /* 表达式生成新字段 */
      case 'groupBy':/* 聚合 */
      case 'rename': /* 字段重命名 */
    }
  }, rows)
}
```

**单测**：`src/data/transform/__tests__/pipeline.test.ts`，覆盖 6 种 op + 组合链 + 空 steps。

**验收**：`pnpm test pipeline` 通过。

### Phase 1 出口检查

- [ ] `pnpm typecheck` 通过
- [ ] `pnpm test` 全部通过
- [ ] `pnpm check:colors` 无新增违规
- [ ] commit：`feat(phase-1): schema v0.2 types + validator + transform pipeline`

---

## Phase 2 — 数据层（3 天）

> 产出物：`src/data/` 完整目录，可独立单测。

### 2.1 适配器基类与注册表 `[阻塞]`

**文件**：`src/data/adapters/base.ts`

```typescript
import type { DataSourceConfig } from '../../types/schema'

export interface FetchContext {
  signal?: AbortSignal
  params?: Record<string, unknown>   // 全局过滤器注入
}

export interface DataSourceAdapter {
  fetch(config: DataSourceConfig, ctx?: FetchContext): Promise<Record<string, unknown>[]>
  test?(config: DataSourceConfig): Promise<{ ok: boolean; message?: string; sampleRows?: number }>
  dispose?(): void
}
```

**文件**：`src/data/adapters/index.ts`（注册表）

```typescript
import type { DataSourceType } from '../../types/schema'
export const adapters: Partial<Record<DataSourceType, DataSourceAdapter>> = {}
export function registerAdapter(type, adapter) { adapters[type] = adapter }
export function getAdapter(type) { /* 找不到时 throw */ }
```

### 2.2 实现三个内置适配器 `[可并行]`

| 文件 | 适配器 | 实现要点 |
|---|---|---|
| `src/data/adapters/static.ts` | static | 直接返回 `config.staticData ?? []` |
| `src/data/adapters/mock.ts` | mock | 基于 `mockTemplate` 生成（可先用 `setTimeout` 模拟延迟 + 返回 staticData，TODO 接 mockjs） |
| `src/data/adapters/api.ts` | api | `fetch` 封装：headers/auth 注入、params 插值（`{{var}}` 从 `ctx.params` 替换）、`dataPath` 用 lodash-get 风格取数（自研 mini `getByPath`）、非 2xx 抛错 |

**单测**：每个适配器一个测试文件，api 适配器用 `vi.stubGlobal('fetch', ...)` mock。

### 2.3 缓存层

**文件**：`src/data/cache.ts`

```typescript
export interface CacheEntry { data: unknown; expireAt: number }
export class DataCache {
  private memory = new Map<string, CacheEntry>()
  get(key: string): unknown | undefined      // 过期返回 undefined
  set(key: string, data: unknown, ttl: number, storage?: 'memory' | 'localStorage'): void
  invalidate(key: string): void
  clear(): void
}
export function buildCacheKey(config: DataSourceConfig): string  // id + params 哈希
```

localStorage 分支注意 `try/catch`（隐私模式可能抛错）。单测覆盖 TTL 过期。

### 2.4 轮询调度器

**文件**：`src/data/scheduler.ts`

```typescript
export class PollScheduler {
  private timers = new Map<string, number>()
  start(cardId: string, interval: number, task: () => Promise<void>): void
  stop(cardId: string): void
  stopAll(): void
  constructor() { /* 监听 visibilitychange，隐藏时 stopAll，可见时由调用方重启 */ }
}
```

注意：用 `window.setInterval`，返回 number；测试用 `vi.useFakeTimers()`。

### 2.5 Pinia DataStore `[阻塞]`

**文件**：`src/data/store.ts`

```typescript
export const useDataStore = defineStore('data', () => {
  const cardData = ref(new Map<string, Record<string, unknown>[]>())
  const cardLoading = ref(new Map<string, boolean>())
  const cardError = ref(new Map<string, Error | null>())
  const dataSources = ref(new Map<string, DataSourceConfig>())  // 项目级数据源注册

  function registerDataSource(ds: DataSourceConfig): void
  async function loadCardData(card: CardSchema, opts?: { force?: boolean }): Promise<void>
  async function refreshPage(cards: CardSchema[]): Promise<void>   // 请求去重：同 dataSourceId 只发一次
  function disposeCard(cardId: string): void
  function disposeAll(): void

  return { cardData, cardLoading, cardError, dataSources, registerDataSource, loadCardData, refreshPage, disposeCard, disposeAll }
})
```

**实现要点**：
- `loadCardData` 流程：解析数据源（`dataSourceId` 优先，回退内联）→ 检查缓存 → `getAdapter(type).fetch()` → `applyTransform(rows, card.transform)` → 写入 `cardData`。
- 请求去重：维护 `inFlight = new Map<string, Promise<...>>()`，key 为 `dataSourceId`。
- `refreshPage`：按 `dataSourceId` 分组，组内并发共享同一 Promise。

**单测**：`src/data/__tests__/store.test.ts`（用 `createPinia` + `setActivePinia`）。

### Phase 2 出口检查

- [ ] `pnpm test` 全绿（适配器/缓存/调度器/store）
- [ ] `pnpm typecheck` 通过
- [ ] commit：`feat(phase-2): data layer (adapters, cache, scheduler, store)`

---

## Phase 3 — 渲染引擎与卡片组件库（4 天）

> 产出物：`SchemaRenderer.vue` + 5 种内置卡片 + 注册表。

### 3.1 卡片注册表 `[阻塞]`

**文件**：`src/engine/registry.ts`（替代 `factory.ts` 的静态 Map，**保留** `factory.ts` 并标注 `@deprecated`，内部转调 registry 以兼容现有代码）

```typescript
import type { Component } from 'vue'
import type { CardSchema, CardType } from '../types/schema'

export interface EditorFieldSchema {
  field: string                 // lodash 路径，如 'chart.chartType'
  label: string
  component: 'MInput' | 'MSelect' | 'MSwitch' | 'MInputNumber'
  options?: { label: string; value: unknown }[] | 'auto:dataFields'
  props?: Record<string, unknown>
}

export interface CardRegistration {
  type: CardType
  component: Component
  editorSchema?: EditorFieldSchema[]
  defaultConfig: () => Partial<CardSchema>
}

const registry = new Map<CardType, CardRegistration>()
export function registerCard(reg: CardRegistration): void
export function getCardRegistration(type: CardType): CardRegistration | undefined
export function getAllCardTypes(): CardType[]
```

### 3.2 通用卡片外壳 `[阻塞]`

**文件**：`src/components/cards/CardShell.vue`

**职责**：统一渲染卡片头（title/subtitle/actions）+ 三态（loading 骨架 / empty / error 重试），内容区用默认插槽。

```vue
<script setup lang="ts">
// props: { title?, subtitle?, loading, error, empty, stateText?, actions? }
// emit: (e: 'retry'), (e: 'action', action)
// 用 morya-ui 的 MCard / MButton / MEmpty / MSkeleton
</script>
```

**注意**：骨架屏用 `MSkeleton`（查 morya-ui 实际组件名，没有则用 `MCard` + 自定义骨架 div，样式用 `--m-*` token）。

### 3.3 五个内置卡片 `[可并行]`

每个卡片都符合 `CardProps` / `CardEmits` 契约（DESIGN-DEV §7.2），用 `CardShell` 包裹。

> **样式要求**：所有卡片白底 + `--m-radius-lg`(20px) + `--m-shadow-card`，内边距 24px；视觉细节对照 `DESIGN-DEV.md` §12.6 样板（KpiBanner / TransactionsPanel / ActiveMembersCard）。

| # | 文件 | type | 实现要点 |
|---|---|---|---|
| 1 | `src/components/cards/StatCard.vue` | stat | 用 `formatValue`（从 `useDataSource.ts` 迁移到 `src/data/format.ts`）渲染数值；trend 用 pill 徽章（§12.5） |
| 2 | `src/components/cards/ChartCard.vue` | chart | 内部调用 `useECharts`（3.4 先增强）；`rawOption` 最后深度合并；配色读 `--m-chart-*` |
| 3 | `src/components/cards/TableCard.vue` | table | 用 morya-ui `MTable`；`columns.render` 映射格式化函数；分页用 `MTable paginator` |
| 4 | `src/components/cards/ListCard.vue` | list | 简单列表；空态走 CardShell；行内配色用 `--m-chart-*` |
| 5 | `src/components/cards/BannerCard.vue` | banner | 渐变背景默认 `var(--m-gradient-brand)`，可被 schema `banner.gradient` 覆盖；阴影 `--m-shadow-banner`；白字 + 半透明白图标底 |

**完成后**：在 `src/components/cards/index.ts` 统一 `registerCard()` 注册全部。

### 3.4 增强 useECharts `[可并行]`

**文件**：`src/composables/useECharts.ts`

**操作**：
1. 追加注册：`AreaChart`（用 LineChart + areaStyle）、`RadarChart`、`ScatterChart`、`FunnelChart`、`GaugeChart`（从 `echarts/charts` 导入）。
2. **修复裸色违规**：`#9CA3AF`、`#F0F0F0` 等改为从 CSS 变量读取。新增 `src/composables/useThemeToken.ts`：
   ```typescript
   export function getToken(name: string, fallback: string): string {
     return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
   }
   ```
   图表默认调色板从 `--m-chart-1..6` 读取（3.5 在 `app.css` 定义）。
3. 支持 `stack`、`seriesField` 多系列拆分、`rawOption` 深度合并（用 `echarts` 的 `setOption(option, { notMerge: false })` 配合自研 `deepMerge`）。
4. 支持暗色主题切换时 `chart.dispose()` + 重建（监听 `data-theme` 变化，可后续 Phase 做，先留 TODO）。

### 3.5 图表 token（已在 Phase 0.5 落地）

> 图表调色板 `--m-chart-1..6` 已在 Phase 0.5 定义于 `src/styles/theme/chart.css`。
> 本步只需确认 `useECharts`（3.4）通过 `useThemeToken` 读取这些变量，**不得再写死 hex**。
> 图表细节（柱圆角、折线宽、坐标轴 muted 色、分隔线 split 色）对照 `DESIGN-DEV.md` §12.6 图表配方。

### 3.6 SchemaRenderer 核心 `[阻塞]`

**文件**：`src/engine/SchemaRenderer.vue`

```vue
<script setup lang="ts">
// props: { page: PageSchema; editable?: boolean }
// emits: (e: 'select-card', id: string), (e: 'card-action', cardId, action)
//
// 1. onMounted: 遍历 page.cards，为每个卡片调 dataStore.loadCardData
// 2. onBeforeUnmount: dataStore.disposeAll()
// 3. 计算 sortedCards（复用 sortCards 逻辑，从 factory.ts 迁移到 engine/utils.ts）
// 4. 渲染：
//    <div class="schema-renderer" :style="{ display:'grid', gridTemplateColumns:`repeat(${cols},1fr)`, gap }">
//      <CardShell 包装的具体卡片组件 :style="{ gridColumn: `span ${card.span ?? 12}` }" />
//    </div>
// 5. editable 模式：外层包 CardWrapper（Phase 4 实现），本阶段先忽略
</script>
```

**响应式**：用 CSS 媒体查询，`< md` 断点时所有卡片 `grid-column: span 12`（或按 `grid.breakpoints` 降列）。

### 3.7 改造 DashboardView 验证渲染器

**文件**：`src/views/DashboardView.vue`

**操作**：不改业务逻辑，新增一个开关：用 `SchemaRenderer` 渲染现有 `dashboardSchema`（作为渲染器的集成验证）。可新增路由 `/demo/renderer` 指向一个 `RendererDemoView.vue`，避免影响现有 demo。

**验收**：
- [ ] `/demo/renderer` 页面能渲染出 KPI banner + 交易面板（与现有 demo 视觉一致）
- [ ] `pnpm test`、`pnpm typecheck`、`pnpm check:colors` 全通过
- [ ] commit：`feat(phase-3): schema renderer + card library`

---

## Phase 4 — 低代码编辑器（5 天）

> 产出物：`src/editor/` + `EditorView.vue`，可拖拽搭建并保存。

### 4.1 EditorStore `[阻塞]`

**文件**：`src/editor/store.ts`

**操作**：实现 `useEditorStore`（字段见 DESIGN-DEV §8.5）。核心是**不可变更新 + 撤销栈**：

```typescript
function updateSchema(mutator: (draft: PageSchema) => void): void {
  const snapshot = structuredClone(page.value)
  past.value.push(snapshot)
  if (past.value.length > 50) past.value.shift()   // 限制栈深
  future.value = []
  mutator(page.value)                               // 直接改（或先 clone 再替换）
  dirty.value = true
}
```

> 用 `structuredClone` 做快照即可，无需引入 immer。`undo/redo` 做栈交换。

**单测**：`src/editor/__tests__/store.test.ts` 覆盖 add/remove/move/resize/undo/redo/dirty。

### 4.2 编辑器骨架布局 `[阻塞]`

**文件**：`src/views/EditorView.vue` + `src/editor/components/EditorTopBar.vue`、`EditorLeftPanel.vue`、`EditorRightPanel.vue`、`EditorCanvas.vue`

**布局**：CSS Grid 三栏（左 240px / 中自适应 / 右 320px），顶栏 48px。用 morya-ui 组件拼装，样式用 `--m-*` token。参考工作区规则 `page-layout.mdc`。

**样式要求**：编辑器自身视觉对齐 `DESIGN-DEV.md` §12.7——面板 `--m-color-surface` 底 + `--m-color-border` 分隔线、画布区 `--m-color-page-bg`（所见即所得）、卡片 hover/选中用主色描边。

**验收**：访问 `/editor/new` 能看到空三栏骨架，且视觉与现有 demo 同风格。

### 4.3 画布与卡片包装器

**文件**：`src/editor/components/EditorCanvas.vue` + `CardWrapper.vue`

**操作**：
1. `EditorCanvas` 内部渲染 `SchemaRenderer`，但**用编辑态数据源**（`editable` 模式：数据照常加载，便于所见即所得）。
2. `CardWrapper` 包裹每张卡片：
   - hover 显示边框（`outline: 2px solid var(--m-color-primary)`）+ 操作浮条（编辑/复制/删除/上移/下移按钮，用 `MButton` + `aria-label`）。
   - 点击选中 → `editorStore.selectCard(id)`，选中态边框常显。
   - 操作浮条按钮调用 store 对应 action。

### 4.4 左侧组件库（拖拽添加）

**文件**：`src/editor/panels/ComponentLibrary.vue`

**操作**：
1. 列出 `getAllCardTypes()`，每项显示图标 + 名称 + 描述。
2. **拖拽**：HTML5 DnD，`dragstart` 设置 `event.dataTransfer.setData('card-type', type)`；画布 `drop` 时 `editorStore.addCard(type, dropIndex)`。
3. **点击添加**：兜底方案（点击加到末尾），保证键盘可用。

**文件**：`src/editor/composables/useDragDrop.ts`（封装 dragover 指示线逻辑）。

### 4.5 右侧属性面板

**文件**：`src/editor/panels/PropertyForm.vue` + `src/editor/components/FieldRenderer.vue`

**操作**：
1. `PropertyForm` 根据 `selectedCard` 从 `getCardRegistration(type).editorSchema` 取表单 schema，逐项交给 `FieldRenderer`。
2. `FieldRenderer` 按 `component` 渲染对应 `M*` 控件，`v-model` 绑定到 `get/set` 路径：
   ```typescript
   // 用 lodash 风格 get/setByPath 读写 page 草稿，修改走 editorStore.updateSchema
   ```
3. `options: 'auto:dataFields'` 时，从该卡片当前数据 `Object.keys(data[0] ?? {})` 生成选项。
4. 数据源绑定区块：`MSelect` 列出所有 `dataSources`，选中写 `dataSourceId`。

### 4.6 撤销 / 重做 / 保存

**文件**：`src/editor/components/EditorTopBar.vue`

**操作**：
- 撤销/重做按钮（`canUndo`/`canRedo` 计算属性控制 disabled），快捷键 `Ctrl+Z` / `Ctrl+Shift+Z`（在 `EditorView` 挂 `keydown` 监听，输入框聚焦时跳过）。
- 保存按钮：调 `services/page.ts`（4.7）持久化；保存成功 `message.success('已保存')`，失败 `message.error(...)`（遵守 feedback 规范：单行反馈用 `message`）。

### 4.7 本地持久化服务

**文件**：`src/services/page.ts`

```typescript
const KEY = 'morya-studio:pages'
export function listPages(): PageSchema[]
export function getPage(id: string): PageSchema | null
export function savePage(page: PageSchema): void      // meta.version = SCHEMA_VERSION; meta.updatedAt
export function deletePage(id: string): void
export function exportPage(id: string): string        // JSON 字符串
export function importPage(json: string): PageSchema  // 校验 + 迁移后返回
```

同理 `src/services/datasource.ts`（key `morya-studio:datasources`）。

### 4.8 页面列表与入口

**文件**：`src/views/PageListView.vue`

**操作**（遵循 `page-layout.mdc` 列表页规范）：`MLayout fillViewport` + `MPageHeader`（标题"我的看板" + `#actions` 一个 primary "新建看板"）+ 看板卡片网格（每张卡片显示标题/更新时间，操作有"编辑/预览/删除"，`MConfirmDialog` 确认删除）。

**新建流程**：点击"新建看板" → 生成新 id → 跳转 `/editor/:id`。

### Phase 4 出口检查

- [ ] 完整走通：新建 → 拖 2 个卡片 → 配数据源 → 改属性 → 撤销/重做 → 保存 → 刷新后恢复
- [ ] `pnpm test`、`pnpm typecheck`、`pnpm check:colors` 全通过
- [ ] 用 MCP `validate_page` 校验 EditorView / PageListView（brief 同页面描述），契约 `ok: true`
- [ ] commit：`feat(phase-4): lowcode editor MVP`

---

## Phase 5 — 数据源管理与 API 接入（3 天）

### 5.1 数据源管理页

**文件**：`src/views/DataSourcesView.vue`

**操作**：列表页规范。`MTable` 列：名称/类型/轮询/操作（编辑/测试/删除）。新建/编辑用 `MDialog` + `MForm`（snippet `form-in-dialog`）。"测试"按钮调对应 adapter 的 `test()`，结果用 `message` 反馈。

### 5.2 API 数据源增强

**文件**：`src/data/adapters/api.ts`

**操作**：
1. 认证注入：bearer → `Authorization: Bearer xxx`；apikey → 自定义 header；basic → base64。
2. 参数插值：递归遍历 `params`，把 `{{varName}}` 替换为 `ctx.params[varName]`。
3. `dataPath` 取数：`getByPath(result, config.dataPath)`，确保返回数组（非数组包一层）。

**单测**：用 mock fetch 覆盖三种认证 + 插值 + dataPath。

### 5.3 编辑器数据源面板联动

**文件**：`src/editor/panels/DataSourcePanel.vue`

**操作**：左侧面板新增"数据源"Tab，列出 `useDataStore().dataSources`，支持"新建数据源"（跳数据源页或弹窗），卡片属性面板的数据源下拉与其联动。

### Phase 5 出口检查

- [ ] 配一个真实公开 API（如 `https://jsonplaceholder.typicode.com/users`）能出图
- [ ] 测试连接功能正常反馈成功/失败
- [ ] commit：`feat(phase-5): datasource management + api adapter`

---

## Phase 6 — 模板库与分享（3 天）

### 6.1 模板库

**文件**：`src/schemas/templates/index.ts` + `src/views/TemplatesView.vue`

**操作**：
1. 内置 5 个模板（每个是一个 `PageSchema`）：SaaS 指标看板（复用现有 dashboard.ts）、销售漏斗、运营周报、实时监控（含轮询配置示例）、空白页。
2. `TemplatesView` 网格展示（缩略图可先用图标占位），点击"使用模板" → 深拷贝 schema 生成新 id → 跳编辑器。
3. 编辑器支持"另存为模板"（存 localStorage `morya-studio:templates`）。

### 6.2 只读 Viewer 与分享

**文件**：`src/views/ViewerView.vue` + 路由 `/view/:pageId`

**操作**：
1. `ViewerView` 只含 `SchemaRenderer`（无编辑器 chrome），顶部一个极简工具条（标题 + 可选"在新窗口打开"）。
2. 分享：编辑器顶栏"分享" → 生成链接 `/view/:pageId`（MVP 阶段本地直接可用；token 机制待后端 Phase 7）。
3. 提供"嵌入代码"复制：`<iframe src="..." width="100%" height="600"></iframe>`，复制成功 `message.success`。

### Phase 6 出口检查

- [ ] 从模板创建 → 编辑 → 保存 → 分享链接可打开只读页
- [ ] commit：`feat(phase-6): templates + viewer + share`

---

## Phase 7 — 后端服务（5 天，可延后）

> 前置：Phase 0.2 已清理 `apps/`。本 Phase 重建 `apps/api`。

### 7.1 初始化 Hono 项目

```bash
mkdir apps\api && cd apps\api
pnpm init
pnpm add hono @hono/node-server zod
pnpm add -D tsx typescript @types/node
```

`apps/api/package.json` scripts：`"dev": "tsx watch src/index.ts"`。

**根目录**：建 `pnpm-workspace.yaml`：
```yaml
packages:
  - 'apps/*'
```
然后 `pnpm install` 重新链接。

### 7.2 API 骨架

**文件**：`apps/api/src/index.ts` + `routes/pages.ts`、`routes/datasources.ts`

**操作**：实现 DESIGN-DEV §13.4 的端点；存储先用 JSON 文件（`apps/api/data/*.json`），接口保持与前端 `services/` 一致，便于切换。

### 7.3 数据源测试代理

**文件**：`apps/api/src/routes/datasources.ts`

`POST /api/datasources/test`：接收 DataSourceConfig，服务端转发请求（解决浏览器 CORS），返回 `{ ok, message, sampleRows, sample: 前3行 }`。

### 7.4 前端切换

**文件**：`src/services/api.ts`（fetch 封装：baseURL、错误统一处理）+ 改造 `page.ts`/`datasource.ts`，通过环境变量 `VITE_API_BASE` 切换 localStorage / 后端。

### Phase 7 出口检查

- [ ] `pnpm dev`（前端）+ `pnpm --filter @morya-studio/api dev`（后端）同时跑通
- [ ] 页面 CRUD 走后端成功
- [ ] commit：`feat(phase-7): hono backend + frontend switch`

---

## 进度追踪表

| Phase | 内容 | 工时 | 状态 | 完成日期 |
|---|---|---|---|---|
| 0 | 环境清理与基线 | 0.5d | ☐ | |
| 1 | Schema v0.2 + 校验 + 表达式 + 管道 | 2d | ☐ | |
| 2 | 数据层（适配器/缓存/调度/Store） | 3d | ☐ | |
| 3 | 渲染引擎 + 5 卡片组件 | 4d | ☐ | |
| 4 | 低代码编辑器 MVP | 5d | ☐ | |
| 5 | 数据源管理 + API 接入 | 3d | ☐ | |
| 6 | 模板库 + 分享 | 3d | ☐ | |
| 7 | 后端服务 | 5d（可延后） | ☐ | |

**MVP 完成线 = Phase 0~4 结束（约 2.5 周）**，即可用编辑器搭看板并本地保存。

---

## 每步通用检查清单（Definition of Done）

任何一步提交前必须全过：

```bash
pnpm typecheck        # 1. 类型零错误
pnpm test             # 2. 单测全绿
pnpm check:colors     # 3. 无新增裸色
pnpm build            # 4. 构建成功
```

5. 新增 UI 页面：用 MCP `validate_page`（brief 与页面用途一致），契约 `ok: true`；工艺建议可注明后放过。
6. 不确定 morya-ui 组件 API 时：先 MCP `get_component`，禁止臆造 prop；写完 `validate_usage`。
7. **风格自检**：新卡片/页面对照 `DESIGN-DEV.md` §12（圆角 20px、`--m-shadow-card`、配色来自 token/图表调色板、数字格式统一），与 `demos/home2.png` 并排比对无违和。

---

## 风险与应对

| 风险 | 触发阶段 | 应对 |
|---|---|---|
| morya-ui 缺少某组件（如 MSkeleton） | P3 | 用 MCP `list`/`search` 查替代品；或用 `MCard` + token 样式自绘，并在卡片注册表注释 |
| 表达式引擎安全漏洞 | P1 | 坚持白名单方案；危险标识符黑名单单测兜底 |
| 编辑器撤销栈内存膨胀 | P4 | 栈深限 50；大 schema 用 `structuredClone` 前评估，必要时改 diff patch |
| ECharts 按需引入类型报错 | P3 | `@types/echarts` 与 v6 可能不匹配，必要时用 `echarts/core` 自带类型，移除 `@types/echarts` |
| 本地存储容量超限（5MB） | P4/P6 | 存储时 `try/catch QuotaExceededError`，提示用户导出备份 |
