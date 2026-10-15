# AGENTS — morya-ui consumer projects

Editor-neutral always-on guidance for AI agents (Cursor, VS Code, Zed, Copilot, CLI agents). This file is the **single source of truth** for project rules — keep all rule content here instead of per-editor copies (`.cursor/rules/`, `.github/instructions/`, ...). The full Chinese rules live in the last section of this file.

## Before generating or editing UI

1. Read project-root `DESIGN.md` (design contract).
2. Prefer skill `.agents/skills/morya-ui-pages/` for page workflows.
3. Prefer MCP `@morya-ui/mcp` for real Props / Events / snippets — never invent API names.

## Hard rules

1. Use only `morya-ui` `M*` components; global styles `morya-ui/styles.css`.
2. Colors / spacing / radius use `--m-*` CSS variables — no raw hex/rgb in business UI (see `scripts/check-raw-colors.mjs`). Brand differences go in theme overrides (`--m-color-primary`, fonts) per `DESIGN.md`.
3. **Composition-first**: with a reference, call MCP `map_reference` (or `recommend_page` + `brief` / `density`) → assemble via `get_page_snippet` from `mapping` / `suggestedSnippets`. Use `page-layouts` as a block-order checklist. `get_golden_page` is optional. Account / Express / Flow signature shells: `get_style_shells`.
4. **Visual direction**: clear reference/description → follow the user; clear cues → infer and say so; unsure → ask (`get_style_direction`). There is no named style-preset table. Do not apply default AI gradients / neon / glass without asking.
5. Form options: `MSelect` / `MTreeSelect`. Action menus: `MDropdown`.
6. Uncertain API → docs site or MCP `get_component`. After writing code: `validate_usage`.
7. Root: `MConfigProvider`. Admin chrome: `MLayout` family.
8. Feedback defaults to `message` API; use `toast` only for summary + detail or async feel; persistent form errors use field `errorMessage` or token-styled `role="alert"`.
9. Before delivery: `validate_page` with the same `brief` — contract `ok` must be true; craft suggestions may be waived with a short note.

## MCP / skills map

| Need | Use |
| --- | --- |
| Page plan + snippets | `recommend_page`, `map_reference`, `get_page_snippet` |
| Signature shells | `get_style_shells` |
| Tokens / composition | `get_design_rules` |
| Component pick | `recommend_component`, `get_component`, `get_example` |
| Offline recipes | skill `references/` under `morya-ui-pages` |

Canonical skills live under `.agents/skills/` (Cursor, Zed, VS Code Copilot). Setup also mirrors them into `.claude/skills`, `.windsurf/skills`, and `.github/skills` for Claude Code / Windsurf / Copilot discovery. MCP configs: Cursor / VS Code / Zed + root `.mcp.json`. Reload MCP after `npx @morya-ui/setup ai`. Zed may require trusting the worktree before project skills load.

---

## 项目细则（中文完整规则）

以下「设计系统」「工作偏好」两节是本项目的常驻规则，对所有支持 AGENTS.md 的工具生效（Cursor / VS Code Copilot / Claude Code / Zed / Windsurf）。上方英文 "Hard rules" 是「设计系统」一节的摘要；表述不一致时以本节为准。更详细的主题规则拆分在 `.agents/rules/` 目录，按文末「详细规则索引」按需阅读。

### 设计系统

1. **先读** 项目根目录 `DESIGN.md`。组件选型用 MCP `recommend_component`（含 recipe + `relatedSnippets`），或 skill `references/decision-recipes.md` / `component-index.md`。
2. **只用** `morya-ui` 的 `M*` 组件；全局样式 `morya-ui/styles.css`。
3. **颜色/间距/圆角** 使用 `--m-*` CSS 变量，禁止裸 hex/rgb（见 `scripts/check-raw-colors.mjs`）。品牌差异优先主题覆盖 `--m-color-primary` / 字体（见 DESIGN.md § 主题覆盖）。
4. **页面组装（composition-first）**：有参考时先 `map_reference`（或 `recommend_page` + `brief` / `density`）→ 按 `mapping` / `suggestedSnippets` 用 `get_page_snippet` 拼装；`page-layouts` 作块顺序 checklist。`get_golden_page` **可选**。Account / Express / Flow 签名壳用 `get_style_shells`。**视觉方向**：明确参考/描述 → 跟用户；线索清晰 → 推断并说明；不确定 → 先问（`get_style_direction`）。**没有命名风格预设表。** 禁止未询问就套 AI 默认渐变/霓虹/毛玻璃。
5. **表单选项** 用 `MSelect` / `MTreeSelect`；**动作菜单** 用 `MDropdown`。
6. 不确定 API 时查文档站或 MCP `get_component`，**禁止臆造 prop**；写完后必须 `validate_usage`。
7. 根节点用 `MConfigProvider`；后台布局用 `MLayout` 系列。
8. **操作反馈默认 `message` API**；仅 `summary + detail` 或异步通知用 `toast`；表单常驻错误用字段 `errorMessage` 或 token 样式的 `role="alert"`（`<MMessage>` 只是 message 宿主）。见 skill `references/feedback.md`。
9. 交付前 `validate_page`（同一 `brief`）：契约 `ok` 必须为 true；工艺建议可说明后放过。

Token / 风格 / companion：MCP `get_design_rules`、`get_style_direction`、`get_style_shells`、`map_reference`；skill `optional-companions.md`（运行时以 `morya-ui/styles.css` 为准）

### 工作偏好

- 测试只跑相关的，不跑全局（如：改 `views/connectors` 只跑 `vitest run connectors`，改 `db/mysql` 只跑 `tsc --noEmit`）
- 分析只聚焦当前问题，不发散检查无关文件
- 验证只验证改的那块，不主动全量回归
- 不主动优化没让改的地方，不"顺手"清理别的代码
- 截图验证只在用户明确要求时做，平时跑测试验证即可

### 详细规则索引（按需阅读）

| 何时阅读 | 文件 |
| --- | --- |
| 编写或修改 TS / Vue 代码前 | `.agents/rules/coding-style.md` |
| 在 Vue 文件中使用 morya-ui 组件前 | `.agents/rules/component-usage.md` |
| 生成完整业务页面（列表/表单/仪表盘等）前 | `.agents/rules/page-layout.md` |

