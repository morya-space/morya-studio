# Development guide

[English](./DEVELOPMENT.md) · [中文](./DEVELOPMENT.zh-CN.md)

Internal documentation for contributors working in this monorepo. Public overview: [root README](../README.md). The web app uses **morya-ui** via a local link (see below).

## Workspace

| Path              | Role                                       |
| ----------------- | ------------------------------------------ |
| `apps/web`        | Platform web app (`http://localhost:5181`) |
| `apps/api`        | Hono + TypeScript API (`http://localhost:3000`) |
| `packages/shared` | Shared types                               |

## UI library

Clone **morya-ui** as a **sibling** of this repo (e.g. `../morya-ui`), run `pnpm install && pnpm build` once, then `pnpm install` here. `apps/web/package.json` links `morya-ui` to that directory.

- Styles: `import 'morya-ui/styles.css'`
- Plugin: `createMoryaUI()` from `morya-ui`

## Commands

```bash
pnpm install
pnpm dev          # web + api in parallel
pnpm dev:web
pnpm dev:api
pnpm typecheck
pnpm test
pnpm build
```

## API docs (local)

- Swagger-like UI: `http://localhost:3000/docs`
- OpenAPI 3.0: `http://localhost:3000/openapi.json`

## Environment

Copy `apps/api/.env.example` to `apps/api/.env` if you need to override defaults. Do not commit `.env`.

## Related docs

| Doc                                            | Topic                                     |
| ---------------------------------------------- | ----------------------------------------- |
| [COMMIT_CONVENTION.md](./COMMIT_CONVENTION.md) | Conventional Commits + husky / commitlint |
