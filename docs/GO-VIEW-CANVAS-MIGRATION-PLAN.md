# GoView 可视化方案迁移/适配 morya-studio 画板 — 方案

> 状态：Draft
> 目标：把 go-view（`D:\Users\chenw\Desktop\projects\go-view`）的「大屏/自由画布」可视化能力，**按 morya-studio 的 Schema 契约与设计令牌体系改造后**引入 morya-studio 画板。
> 关系：本文落实 `docs/DESIGN-DEV.md` §2.3「大屏模式（自由画布、深色背景）」这一远期 Backlog，并遵守 `AGENTS.md` / `DESIGN.md` 的硬规则。

---

## 一、结论先行

**不要把 go-view 整体搬过来，也不要把 morya-studio 改成 go-view 的数据模型。**

- morya-studio 是 **Schema/JSON 驱动**（`PageSchema` 单一事实源，ADR-1）+ **令牌化 UI**（`--m-*` + `morya-ui` M* 组件）+ **后端权威持久化**。
- go-view 是 **自由画布大屏工具**：`componentList` + `EditCanvasConfig` 双存储、`window.$vue` 全局动态注册组件、sessionStorage 持久化、naive-ui、VChart。

**正确做法**：保留 morya-studio 的 Schema 作为唯一数据模型，把 go-view 的**交互机制与面板编排经验**抽取成可复用逻辑，落到现有 `src/engine` + `src/editor` + `src/types/schema.ts` 上：

1. **Schema 升级到 v3**：在 `CardSchema` 上补 `styles / status / events / groupId`，在 `PageSchema` 上补 `mode / groups`，`CanvasConfig` 补背景图与缩放策略。
2. **画布内核重写（但复用 go-view 算法思路）**：把 `useDrag.hook.ts` 的移动/缩放/框选/辅助线吸附算法、`EditShapeBox` 的 8 向手柄、标尺同步、图层/分组语义，用 Vue 响应式 + Pointer Events + `--m-*` 令牌重新实现。
3. **统一编辑器与运行时渲染**：兑现 DESIGN-DEV ADR-6 —— 编辑态与预览态共用一套 `SchemaRenderer`，编辑态只叠加一个「交互覆盖层」（手柄/辅助线/框选）。
4. **组件包体系演进**：把 `engine/registry.ts` 从「静态 Map」升级为「注册表 + 可选动态包导入」，并让 `services/component` 的自定义组件真正进入组件库。
5. **数据层不重造**：go-view 的请求/轮询/过滤/数据池，morya-studio 的 `src/data` 已有等价物（adapters / scheduler / cache / transform / 安全表达式）。只补「共享请求/数据池」与「组件交互联动」两块。

---

## 二、模型对比

| 维度 | go-view | morya-studio 现状 | 迁移策略 |
| --- | --- | --- | --- |
| 数据模型 | `chartEditStore`（componentList + editCanvasConfig）独立 Pinia | `PageSchema` 单一 JSON（`src/types/schema.ts`） | **保留 Schema**，把 go-view 字段映射进去 |
| 布局 | 绝对定位大屏 1920×1080 | `layout: 'grid' \| 'free'` 双模式，free 已支持 x/y/w/h | **强化 free** 为大屏模式 |
| 组件注册 | `window.$vue.component(chartKey, …)` 全局注册 + `import.meta.glob` | `engine/registry.ts` 静态 `Map<CardType,…>` | 保留注册表，加**动态包导入**与自定义组件接入 |
| 组件目录 | `packages/components/**/{index.ts,config.ts,index.vue,config.vue}` 每组件四件套 | `src/components/cards/*.vue` + `editorSchema` 表单 Schema | 保留「注册表 + editorSchema」；借鉴 config 四件套的**目录约定** |
| 撤销/重做 | `chartHistoryStore` 多动作类型栈（ADD/MOVE/GROUP/…） | `editor/store.ts` 整页快照栈（MAX 50） | 保留快照栈，**升级为分组/批量动作也整体成帧** |
| 交互 | 移动/8 向缩放/框选/辅助线/分组/锁定/隐藏/标尺/缩放 | 移动/8 向缩放/吸附步长/单选框选中 | **补齐**：框选、多选、辅助线、分组、锁定隐藏、标尺、缩放工具栏、右键菜单 |
| 数据绑定 | 请求/轮询/数据池/过滤函数(`new Function`) | adapters/scheduler/cache/transform/安全表达式引擎 | **复用现有**，仅补共享请求与联动 |
| 事件 | 基础事件 + 高级生命周期 + 交互联动（Monaco 写函数） | `CardSchema.actions`（声明式，未执行） | 改为**声明式 `events.interactions`** + 白名单沙箱 |
| 渲染 | 编辑/预览各自一套 | 编辑重写渲染，预览用 `SchemaRenderer`（ADR-6 被违背） | **统一到 SchemaRenderer** |
| 持久化 | sessionStorage + JSON 导出 | 后端 CRUD + 版本 + 分享 token | 保留后端，仅扩 Schema |
| UI 库 | naive-ui | morya-ui (M*) + `--m-*` | **只用 M***，禁裸色 |

---

## 三、迁移原则（取 / 不取 / 改造）

### ✅ 直接借鉴逻辑（重写到本项目代码栈）
- 自由画布交互内核：移动、8 向缩放、**框选（marquee）多选**、**对齐辅助线吸附**、网格吸附。
- 画布 **缩放 + 标尺 + 底部工具条（缩放百分比/锁比例）**。
- **图层/大纲**：置顶置底、上移下移、拖拽排序、锁定、隐藏。
- **分组**：成组/解组、组内相对定位。
- 组件 **目录与配置约定**：`config`（默认值） / `index.vue`（渲染） / 表单 Schema（属性面板）。
- **动画**（animate.css 类名）与**丰富样式**（透明度/滤镜/混合模式/旋转斜切）。
- **预览缩放策略**：`FIT / SCROLL_X / SCROLL_Y / FULL`。
- **导出**：截图（html2canvas）、JSON 导入导出。
- 交互联动的**数据模型**（源组件 emit → 目标组件参数绑定）。

### ❌ 不取
- `window.$vue` 全局组件注册（保持注册表 `getCardComponent`）。
- sessionStorage 持久化、mock 项目列表（保持后端权威）。
- naive-ui、VChart（ADR-4：ECharts 唯一；VChart 列为可选远期）。
- go-view 的 `editCanvasConfig` 独立 store（并入 `PageSchema.canvas`）。
- 直接在业务里 `new Function` 执行用户函数（改为受限沙箱 + 显式开关）。

### 🔧 改造点
- 所有新增组件 / 样式 **必须走 `--m-*` token**（`pnpm check:colors`）。
- 交互用 **Pointer Events + Vue 响应式**，而非 go-view 的命令式 DOM 操作（`_drawAlignLine` 等）。
- 事件绑定改为 **Schema 声明式**（可序列化、可 AI 生成、可分享），而非存函数字符串。

---

## 四、目标架构

```
PageSchema (v3, 单一事实源)
├─ mode: 'dashboard' | 'screen'          // 新增：看板 / 大屏
├─ layout: 'grid' | 'free'
├─ canvas: CanvasConfig (+bgImage/scaleType)
├─ groups?: CardGroup[]                  // 新增
├─ filters?: PageFilter[]
└─ cards: CardSchema[]
    ├─ x/y/w/h | span
    ├─ groupId?                          // 新增：所属分组
    ├─ styles?  { opacity/filter/blend/rotate/animations }   // 新增
    ├─ status?  { lock/hide }                                // 新增
    └─ events?  { base/interactions }                        // 新增

渲染路径（统一，兑现 ADR-6）
SchemaRenderer(page, { editable })
├─ <CanvasSurface>           // 缩放/网格/背景/自由定位，编辑与预览共用
│   └─ v-for card → <CardNode stage="edit"|"view">
│        └─ registry.getCardComponent(type) + CardShell
├─ 编辑态叠加层（仅 editable）
│   ├─ SelectionLayer  // 选中框 + 8 向手柄
│   ├─ AlignGuides     // 辅助线
│   ├─ MarqueeLayer    // 框选
│   └─ RulerLayer      // 标尺 + 缩放工具条

编辑态状态（src/editor/store.ts）
PageSchema + selection:Set<id> + groups + 撤销快照栈 + zoom
```

---

## 五、Schema v3 契约设计

> 落点：`src/types/schema.ts`（前端），并同步 `packages/shared/src/schema.ts`（后端共享，当前为重复副本）。`SCHEMA_VERSION: 2 → 3`。

```ts
export const SCHEMA_VERSION = 3

// ---- 新增：卡片样式（对齐 go-view styles，但字段名走本项目风格） ----
export interface CardStyles {
  opacity?: number          // 0~1
  hueRotate?: number        // deg
  saturate?: number
  contrast?: number
  brightness?: number
  rotateZ?: number
  skewX?: number
  skewY?: number
  blendMode?: string        // CSS mix-blend-mode
  animations?: string[]     // animate.css 类名，最多 1 个（简洁优先）
}

export interface CardStatus {
  lock?: boolean
  hide?: boolean
}

// ---- 新增：事件与联动（声明式、可序列化） ----
export type BaseEventName = 'click' | 'dblclick' | 'mouseenter' | 'mouseleave'

export interface InteractBinding {
  /** 目标卡片/数据源请求参数名（params 或 header 的 key） */
  target: string
  /** 源组件 emit 载荷的取值路径，如 'data.name' */
  source: string
}

export interface InteractEvent {
  id: string
  /** 触发时机（源组件抛出的事件名） */
  on: string                 // 由 CardRegistration.emitEvents 提供候选
  /** 目标：其他卡片 或 页面数据源 */
  targetCardId: string
  /** 参数映射 */
  bindings: InteractBinding[]
  enabled?: boolean
}

export interface CardEvents {
  base?: Partial<Record<BaseEventName, ActionConfig[]>>  // 复用现有 ActionConfig
  interactions?: InteractEvent[]
}

// ---- CardSchema 扩展 ----
export interface CardSchema {
  // …现有字段不变…
  styles?: CardStyles
  status?: CardStatus
  events?: CardEvents
  preview?: { overflowHidden?: boolean }
  /** 所属分组 id（分组信息存 PageSchema.groups，卡片保持扁平） */
  groupId?: string
}

// ---- 分组 ----
export interface CardGroup {
  id: string
  name: string
  x: number; y: number; w: number; h: number
  locked?: boolean
  hidden?: boolean
  order?: number
}

// ---- PageSchema 扩展 ----
export interface CanvasConfig {
  // …现有…
  backgroundImage?: string
  /** 预览/大屏缩放策略 */
  scaleType?: 'fit' | 'scrollX' | 'scrollY' | 'full'
  /** 画布主题（大屏默认深色） */
  theme?: 'light' | 'dark'
}

export interface PageSchema {
  // …现有…
  /** 页面形态：dashboard（栅格看板）/ screen（自由大屏） */
  mode?: 'dashboard' | 'screen'
  groups?: CardGroup[]
}
```

**注册表扩展**（`src/engine/registry.ts`）：

```ts
export interface CardRegistration {
  // …现有…
  /** 该组件向上抛出的事件（供交互联动选择源） */
  emitEvents?: Record<string, { value: string; label: string }[]>
  /** 组件包来源（可选：'builtin' | 'custom' | 包 id） */
  packageId?: string
  /** 渲染所需的最小尺寸（拖入默认尺寸已有 DEFAULT_SIZES，迁到这里） */
  defaultSize?: { w: number; h: number }
}
```

**决策说明**
- **分组采用「扁平卡片 + `groupId` + `groups[]`」**，而非 go-view 的嵌套 `groupList`。原因：现有渲染/数据/校验都按扁平 `cards` 遍历；`groupId` 方案避免坐标重基（rebase）与深层递归，撤销/序列化也更简单。渲染时按 `group` 的包围盒作为整体拖拽。
- **事件声明式化**：避免 go-view 的 `new Function` 存字符串。基础事件复用 `ActionConfig`；联动用 `InteractEvent` 绑定。

---

## 六、模块映射表（go-view → morya-studio）

| go-view 文件/模块 | morya-studio 落点 | 处理方式 |
| --- | --- | --- |
| `views/chart/ContentEdit/hooks/useDrag.hook.ts`（move/resize/box-select/_runAlignSnap） | `src/editor/composables/useCanvasDrag.ts`（新） | **重写**，算法思路复用 |
| `ContentEdit/components/EditShapeBox/index.vue`（8 手柄） | `src/editor/components/SelectionLayer.vue`（新） | 重写，token 化 |
| `ContentEdit/components/EditRange`,`EditRule`（标尺/画布面） | `src/engine/CanvasSurface.vue` + `src/editor/components/RulerLayer.vue` | 重写；标尺库若引入需评估 |
| `ContentEdit/components/EditGroup`、`setGroup/setUnGroup` | `src/editor/store.ts` + `groups` | 改为 `groupId` 扁平方案 |
| `store/modules/chartEditStore`（画布/选择/图层/缩放） | `src/editor/store.ts` | **扩展**（selection 集合、groups、zoom 已有） |
| `store/modules/chartHistoryStore` | `src/editor/store.ts` 快照栈 | 保留快照，手势整体入栈（`beginChange` 已有） |
| `store/modules/chartLayoutStore`（面板开关） | `src/editor/panels/*` 本地状态或轻量 store | 简化实现 |
| `packages/index.ts`（glob 动态注册） | `src/engine/registry.ts` + `src/services/component` | 注册表 + 自定义组件接入 |
| `packages/public/publicConfig.ts`（默认 attr/styles/events） | `src/engine/registry.ts` + `migrate.ts` 默认值 | 默认值收敛到注册表 `defaultConfig` |
| `packages/components/**`（图表/装饰/信息/媒体） | `src/components/cards/*` + 新增目录 | 分批补齐（见 Phase 3） |
| `hooks/useChartDataFetch.hook.ts` | `src/data/store.ts`（已有） | 复用 |
| `hooks/useChartDataPondFetch.hook.ts`（数据池） | `src/data/store.ts` 新增共享请求 | 新增 |
| `hooks/useChartInteract.hook.ts`（联动） | `src/data/store.ts` + `src/engine/interactions.ts`（新） | 新增（声明式） |
| `hooks/useLifeHandler.hook.ts`（事件） | `src/engine/events.ts`（新，沙箱执行） | 新增 |
| `ContentConfigurations/**`（属性/动画/数据/事件 tab） | `src/editor/panels/PropertyForm.vue` + 新 tab 面板 | 扩展为多 tab |
| `ChartItemSetting/{CollapseItem,SettingItemBox}` | `src/editor/panels/PropGroup.vue`（已有） | 复用 |
| `settings/animations` | `src/constants/animations.ts`（新） | 新增 |
| `utils/utils.ts canvasCut`（html2canvas） | `src/lib/export.ts` | 新增（按需引入依赖） |
| `views/preview/**`（缩放策略） | `src/views/preview/*` + `SchemaRenderer` | 扩展 `scaleType` |
| `settings/chartThemes` | 现有 `--m-chart-*` token / `useECharts` | 复用，不引入 go-view 主题表 |

---

## 七、分阶段实施计划

> 每阶段结束需：`pnpm typecheck` 通过 + 相关 `vitest run <pattern>` 通过 + `pnpm check:colors` 无违规（见 `AGENTS.md` 工作偏好：只跑相关测试，不做全量回归）。

### Phase 0 — 契约与迁移基础（Schema v3）
**产出**：类型 + 迁移 + 校验 + 单测。
- `src/types/schema.ts`：加 `CardStyles/CardStatus/CardEvents/InteractEvent/CardGroup`，扩 `CardSchema/PageSchema/CanvasConfig`，`SCHEMA_VERSION=3`。
- `packages/shared/src/schema.ts`：同步（并立项消除双份漂移，见风险 R5）。
- `src/engine/migrate.ts`：v2→v3 —— 补 `mode`（`layout:'free'` → `'screen'`，否则 `'dashboard'`）、`cards[].styles/status` 默认值、`page.groups=[]`。
- `src/engine/validate.ts`：新增规则 —— groupId 必须存在于 groups；styles 数值范围；events.interactions 的 targetCardId 存在且非自指；`emitEvents.on` 合法。
- 测试：扩 `src/engine/__tests__/migrate.test.ts`、`validate.test.ts`。

**验收**：旧 v2 页面加载后自动迁移到 v3，`validatePage` 对含分组/样式/事件的样例返回 `valid:true`。

---

### Phase 1 — 画布内核升级（大屏自由画布）
**产出**：`src/engine/CanvasSurface.vue` + `src/editor/composables/useCanvasDrag.ts` + 覆盖层组件。
- **CanvasSurface**（编辑/渲染共用）：缩放（`zoom`）、背景（`bgColor/backgroundImage/grid*`）、自由定位渲染；抽出 `SchemaRenderer` 的自由布局分支复用。
- **useCanvasDrag**（借鉴 `useDrag.hook.ts`，Pointer Events 重写）：
  - move / 8 向 resize（复用 `FreeCard` 算法，抽成 composable）；
  - **框选多选**（marquee）；
  - **对齐辅助线吸附**：9×9 边/中线对齐 + 相对「其它卡片」与「画布」参考，最近 `delta <= snapRange` 命中；用响应式 `guides: Guide[]` 渲染 `<AlignGuides>`，替代 go-view 命令式 DOM 画线；
  - **网格吸附**（现有 `snapStep`）+ 辅助线吸附共存（辅助线优先）。
- **SelectionLayer**：多选（`selection: Set<id>`）、8 手柄、整组包围盒、锁/隐态样式。
- **RulerLayer**（可选）：标尺 + 缩放工具条（百分比/锁比例/滑块）。
- **store 扩展**（`src/editor/store.ts`）：
  - `selection: Set<string>` 替代单一 `selectedCardId`（保留 `selectedCard` 兼容计算）；
  - `setSelection/addToSelection/clearSelection`；
  - `moveSelection(dx,dy)`、`resizeSelection(...)`；
  - `groupSelection()/ungroup()`、`toggleLock/toggleHide`；
  - `bringForward/sendBackward`（相对预览层级）；
  - 手势整体入栈：沿用 `beginChange()`（一次手势一帧）。
- **右键菜单**：`MDropdown` 包一层画布上下文菜单（复制/删除/置顶/置底/成组/锁定/隐藏）。

**验收**：可框选多卡整体拖动；拖动时出现辅助线并吸附；成组/解组后坐标往返正确；锁定卡片不可拖；撤销一次恢复整段手势。

---

### Phase 2 — 编辑器与渲染器统一 + 面板
**产出**：兑现 ADR-6，消除编辑/预览渲染分叉。
- 用 **SchemaRenderer + editable 叠加层** 替换 `EditorCanvas.vue` / `FreeCard.vue` / `CardWrapper.vue` 的重复渲染逻辑；`FreeCard` 只保留「编辑态壳」，内容段改为共用 `CardNode`。
- **属性面板多 Tab**（`src/editor/panels/`）：属性（现有）/ 布局(position)/ 样式(styles)/ 动画/ 数据/ 事件。
  - 复用 `PropGroup.vue`；新增 `StylesPanel.vue`（opacity/filter/blend/rotate）、`AnimationPanel.vue`、`EventPanel.vue`、`InteractionPanel.vue`。
- **图层面板升级**（`OutlinePanel.vue`）：加隐藏/锁定切换、组折叠、真·拖拽调层序（现仅数组重排）；与 `order`/`zIndex` 对齐。
- **组件库扩展**（`ComponentLibrary.vue` + `services/component`）：把用户自定义组件（`CustomComponent`）注入注册表并出现在组件库。

**验收**：编辑态与预览态渲染一致（同一 SchemaRenderer）；样式/动画/事件面板可编辑并存档；自定义组件可拖入画布。

---

### Phase 3 — 组件包体系扩展
**产出**：从 7 个内置卡扩到「图表 + 基础 + 布局 + 媒体 + 装饰」目录。
- `registry.ts`：`category` 增 `'media' | 'decorate'`；可选 `import()` 动态包（懒加载）。
- 新增卡片：`group`（容器/分组渲染）、`image`（图片/背景）、`divider/decoration`（装饰条、边框）、更多图表类型（已有 8 种，按需扩）。
- 每个新组件遵循约定：`*.vue`（渲染）+ `defaultConfig/editorSchema/emitEvents/defaultSize`（注册）。
- 目录约定（借鉴 go-view 四件套，但适配本项目）：
  ```
  src/components/cards/<category>/<Name>Card.vue
  src/components/cards/<category>/<name>.registration.ts   // registerCard 调用
  ```
- 自定义组件持久化模型补 `editorSchema/emitEvents`，使其进入注册表后与内置卡等价。

**验收**：新增组件通过注册表即可出现在组件库、可拖入、属性面板自动生成、可绑定数据。

---

### Phase 4 — 数据与交互增强
**产出**：共享请求（数据池）+ 声明式联动 + 事件沙箱。
- **共享请求/数据池**：`src/data/store.ts` 引入按「数据源 id + 参数签名」复用的请求去重与订阅（现有已有 in-flight 去重与 cache，扩展为多卡订阅同一数据源）。参考 `useChartDataPondFetch.hook.ts` 的 `mittDataPondMap` 思路。
- **声明式联动**（新 `src/engine/interactions.ts`）：组件通过 `emitEvents` 抛出载荷 → `InteractEvent.bindings` 写入目标卡片/数据源的 params 或 header → 触发目标刷新。
  - 源组件以 `emit('interact', { event, payload })` 形式抛出；由 `CardNode` 统一转发。
  - 目标解析复用 `dataStore` + `settingsStore` 参数注入（与 `PageFilter` 的 `{{var}}` 注入统一）。
- **事件执行**：`src/engine/events.ts` 执行 `events.base` 的 `ActionConfig`（导航/刷新/导出/自定义）。**禁止** `new Function` 裸执行；如确需表达式，走 `src/data/transform/expr.ts` 的安全沙箱。
- **动画**：`src/constants/animations.ts` + `CardNode` 应用 `styles.animations`。

**验收**：两张卡绑定同一数据源只发一次请求；点击 A 卡使 B 卡按参数刷新；禁用事件时联动不触发；表达式无法访问全局对象（安全测试）。

---

### Phase 5 — 持久化 / 迁移 / 导出 / 预览
**产出**：全新字段贯通存储、版本、分享、导出。
- `src/services/page`：保存/读取携带 v3 字段；`apps/api` 的 zod 校验（`apps/api/src/routes/pages.ts`）同步新增字段（否则会被裁剪）。
- `src/engine/migrate.ts`：确保后端返回的旧版本也能迁移。
- **预览缩放策略**：`SchemaRenderer` / `PreviewView` 支持 `canvas.scaleType`（fit/scrollX/scrollY/full）。
- **导出**：`src/lib/export.ts` —— JSON 导入导出（已有 `services/page.import/export`）+ 截图导出（html2canvas，按需 `import()`，避免增大主包）。
- **大屏深色主题**：`page.canvas.theme='dark'` 时作用域覆盖 `--m-*` 变量（不硬编码颜色）。

**验收**：保存 v3 页面 → 重载 → 分享链接只读渲染一致；导出截图包含画布；深色大屏仅覆盖根变量。

---

### Phase 6 — 打磨
- 键盘：方向键微移（已有）、Shift 加速、Ctrl+G/Shift+G 成组、Ctrl+L/H 锁/隐、Delete、Escape。
- 右键菜单、空态、`ErrorBoundary`、无障碍（手柄 `aria-label`、焦点管理）。
- 性能：多卡拖拽时的辅助线/选中重绘节流（参考 go-view 的 throttle，但保持响应式）。
- 文档：更新 `docs/DESIGN-DEV.md` §2.3（大屏从 Out of Scope → In Scope）+ §17 路线图 + §5 Schema。

---

## 八、关键设计决策（ADR 增补）

| 编号 | 决策 | 理由 |
| --- | --- | --- |
| ADR-7 | 分组用「扁平 cards + `groupId` + `groups[]`」而非嵌套 groupList | 现有渲染/数据/校验均扁平；避免坐标重基与深递归 |
| ADR-8 | 编辑器与预览共用 `SchemaRenderer` + `editable` 叠加层 | 兑现 ADR-6，消除编辑/预览分叉 |
| ADR-9 | 事件/联动声明式序列化，事件执行走安全沙箱 | 可分享、可 AI 生成、防注入（替代 go-view `new Function`） |
| ADR-10 | 组件注册表 + 可选动态包导入，不使用 `window.$vue` 全局注册 | 保留类型安全与 tree-shaking |
| ADR-11 | 大屏深色通过画布作用域覆盖 `--m-*` 变量实现 | 遵守 `DESIGN.md` 令牌规范 |
| ADR-12 | 画布交互用 Pointer Events + Vue 响应式 | 可测试、可维护，替代 go-view 命令式 DOM |

---

## 九、风险与取舍

| 编号 | 风险 | 缓解 |
| --- | --- | --- |
| R1 | 标尺：go-view 依赖 `vue3-sketch-ruler` 并把其 `panzoom` 当缩放源 | 标尺设为**可选**（Phase 1 可暂缓）；如引入，缩放仍以 store `zoom` 为准，标尺只做展示 |
| R2 | 分组坐标往返（go-view rebase 有 bug 面） | 用 `groupId` 扁平方案，卡片坐标始终是画布绝对坐标 |
| R3 | 事件函数安全面 | 声明式 + 沙箱；不使用 `new Function` |
| R4 | 后端 zod 未同步字段导致保存丢字段 | Phase 5 强制同步 `apps/api` 校验；加集成测试 |
| R5 | `src/types/schema.ts` 与 `packages/shared/src/schema.ts` 双份漂移 | Phase 0 起让前端从 `@morya-studio/shared` re-export，消除重复（可单列小任务） |
| R6 | 编辑器与预览统一可能引入回归 | 保留现有单测；统一后再删 `FreeCard` 重复渲染；先并存灰度 |
| R7 | ECharts 已在图表卡强耦合，扩容需保持 token 颜色 | 新图表仍走 `--m-chart-*`，禁裸色（`check:colors`） |
| R8 | 快照式撤销在超大画布下的内存 | 维持 MAX_HISTORY，必要时对大数组做结构共享/增量栈（远期） |

---

## 十、验证与测试

- **单元**：
  - `vitest run engine/__tests__/migrate`（v2→v3 往返）
  - `vitest run engine/__tests__/validate`（分组/样式/事件规则）
  - `vitest run editor/__tests__/store`（多选/分组/手势单帧撤销）
  - `vitest run data/store`（共享请求去重、联动参数注入）
  - 新增：`src/editor/composables/__tests__/useCanvasDrag.test.ts`（吸附算法纯函数化后测试）
- **类型/规范**：`pnpm typecheck`、`pnpm check:colors`。
- **手工验收（仅用户要求时截图）**：自由画布拖拽/框选/辅助线/分组/图层/缩放；预览与编辑一致。
- **不主动全量回归**：按改动范围跑相关用例（AGENTS.md 工作偏好）。

---

## 十一、工作量估算（相对）

| 阶段 | 规模 | 说明 |
| --- | --- | --- |
| Phase 0 Schema v3 | S | 类型 + migrate + validate |
| Phase 1 画布内核 | **L** | 交互重写，工作量最大 |
| Phase 2 渲染统一 + 面板 | M–L | 重构 + 多 tab 面板 |
| Phase 3 组件包扩展 | M | 按数量线性增长 |
| Phase 4 数据与交互 | M | 复用现有数据层 |
| Phase 5 持久化/导出/预览 | M | 前后端字段同步 |
| Phase 6 打磨 | S | |

**建议**：先做 **Phase 0 + Phase 1**（验证「大屏自由画布」内核），再按需推进后续；Phase 3 的组件数量可长期增量。

---

## 附录 A：最小可用切片（MVP of the migration）

若只想尽快看到「像 go-view 的大屏画布」：
1. Phase 0（Schema v3 最小字段：`styles/status/groupId/groups`）
2. Phase 1 的 **框选多选 + 对齐辅助线 + 成组 + 锁定/隐藏 + 图层**
3. Phase 2 的 **SchemaRenderer 统一 + 图层面板**
4. Phase 5 的 **预览 fit 缩放 + JSON 导出**

这四步即可形成可交付的大屏编辑闭环，其余（组件扩容、联动、截图导出、标尺）增量补齐。
