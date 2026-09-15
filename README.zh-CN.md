# Morya Studio

[English](./README.md) · [中文](./README.zh-CN.md)

**Morya Studio** 是可视化设计平台的 monorepo。平台基础能力（登录、会话、用户 / 角色 / 权限）已接通前后端；工作台、仪表盘、数据集仍是占位页，留给后续自定义。

平台前端通过本地 link 使用 **morya-ui**（同级目录 `../morya-ui`）。

| 资源       | 链接                                                                       |
| ---------- | -------------------------------------------------------------------------- |
| UI 组件库  | `morya-ui`（同级目录 checkout）                                            |
| 贡献者文档 | [开发指南](./docs/DEVELOPMENT.zh-CN.md) · [English](./docs/DEVELOPMENT.md) |

## 仓库结构

| 路径              | 作用           |
| ----------------- | -------------- |
| `apps/web`        | 平台前端       |
| `apps/api`        | 平台 API       |
| `packages/shared` | 前后端共享类型 |
| `docs/`           | 对内开发文档   |

## 快速开始

```bash
pnpm install
pnpm dev
```

- 前端：`http://localhost:5181`
- API 健康检查：`http://localhost:3000/health`
- API 文档：`http://localhost:3000/docs`
- 内置超级管理员：`admin@morya.local` / `admin123`（用户表为空时自动创建，拥有全部权限）

复制 `apps/api/.env.example` 为 `apps/api/.env` 以覆盖数据库与端口。空库会自动创建 `users`、`roles`、`user_roles`、`role_permissions`、`sessions`、`login_events` 表。

## 参与开发

本地命令与提交规范等维护者文档见：

- **[开发指南](./docs/DEVELOPMENT.zh-CN.md)**
- [提交规范](./docs/COMMIT_CONVENTION.md)
