# 开发指南

[English](./DEVELOPMENT.md) · [中文](./DEVELOPMENT.zh-CN.md)

本仓库贡献者用的对内文档。对外说明见 [根 README（中文）](../README.zh-CN.md)。平台前端通过本地 link 使用 [Roost Design UI](https://github.com/roost-design/roost-design-ui)（见下方说明）。

## Workspace

| 路径              | 作用                                |
| ----------------- | ----------------------------------- |
| `apps/web`        | 平台前端（`http://localhost:5181`） |
| `apps/api`        | Hono API（`http://localhost:3000`） |
| `packages/shared` | 共享类型                            |

## UI 组件库

将 [roost-design/roost-design-ui](https://github.com/roost-design/roost-design-ui) 克隆为本仓库的**同级目录**（例如 `../wex-design-ui`），执行 `pnpm install && pnpm build` 构建一次，再在本仓库执行 `pnpm install`。`apps/web/package.json` 通过 link 引用 `@roost-design/ui`。

- 文档站：https://roost-design.github.io/roost-design-ui/
- 样式：`import '@roost-design/ui/styles.css'`
- 插件：`createRoostDesign()`（来自 `@roost-design/ui`）

## 常用命令

```bash
pnpm install
pnpm dev
pnpm dev:web
pnpm dev:api
pnpm typecheck
pnpm test
pnpm build
```

## 本地 API 文档

- 文档页：`http://localhost:3000/docs`
- OpenAPI：`http://localhost:3000/openapi.json`

## 环境变量

如需覆盖默认值，复制 `apps/api/.env.example` 为 `.env`；不要提交 `.env`。

## 相关文档

| 文档                                           | 内容     |
| ---------------------------------------------- | -------- |
| [COMMIT_CONVENTION.md](./COMMIT_CONVENTION.md) | 提交规范 |
