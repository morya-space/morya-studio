# Morya Studio

[English](./README.md) · [中文](./README.zh-CN.md)

**Morya Studio** 是可视化设计平台的 monorepo 脚手架。当前产品需求尚未确定，仓库仅保留空白前端页面与最小 API 壳层。

平台前端通过本地 link 使用 **morya-ui**（同级目录 `../morya-ui`）。

| 资源       | 链接                          |
| ---------- | ----------------------------- |
| UI 组件库  | `morya-ui`（同级目录 checkout） |
| 贡献者文档     | [开发指南](./docs/DEVELOPMENT.zh-CN.md) · [English](./docs/DEVELOPMENT.md)           |

## 仓库结构

| 路径              | 作用         |
| ----------------- | ------------ |
| `apps/web`        | 平台前端     |
| `apps/api`        | 平台 API     |
| `packages/shared` | 前后端共享类型 |
| `docs/`           | 对内开发文档 |

## 快速开始

```bash
pnpm install
pnpm dev
```

- 前端：`http://localhost:5181`
- API 健康检查：`http://localhost:3000/health`
- API 文档：`http://localhost:3000/docs`

## 参与开发

本地命令与提交规范等维护者文档见：

- **[开发指南](./docs/DEVELOPMENT.zh-CN.md)**
- [提交规范](./docs/COMMIT_CONVENTION.md)
