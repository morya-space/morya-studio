# Development guide

[English](./DEVELOPMENT.md) · [中文](./DEVELOPMENT.zh-CN.md)

Internal documentation for contributors working in this monorepo. Public overview: [root README](../README.md). The web app uses [Wise Kit UI](https://github.com/wise-kit/wise-kit-ui) via a local link (see below).

## Workspace

| Path              | Role                                       |
| ----------------- | ------------------------------------------ |
| `apps/web`        | Platform web app (`http://localhost:5181`) |
| `apps/api`        | Hono + TypeScript API (`http://localhost:3000`) |
| `packages/shared` | Shared types                               |

## UI library

Clone [wise-kit/wise-kit-ui](https://github.com/wise-kit/wise-kit-ui) as a **sibling** of this repo (e.g. `../wise-kit-ui`), run `pnpm install && pnpm build` once, then `pnpm install` here. `apps/web/package.json` links `@wise-kit/ui` to that directory.

- Docs: https://wise-kit.github.io/wise-kit-ui/
- Styles: `import '@wise-kit/ui/styles.css'`
- Plugin: `createWiseKit()` from `@wise-kit/ui`

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
