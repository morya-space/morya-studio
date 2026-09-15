# Morya Studio

[English](./README.md) · [中文](./README.zh-CN.md)

**Morya Studio** is a monorepo for a visual design platform. Platform basics (auth, sessions, users / roles / permissions) are wired end to end. Workbench, dashboard, and dataset remain placeholders for later custom work.

The web app uses **morya-ui** via a local link to the sibling `../morya-ui` checkout.

| Resource     | Link                                       |
| ------------ | ------------------------------------------ |
| UI library   | `morya-ui` (sibling checkout)              |
| Contributors | [Development guide](./docs/DEVELOPMENT.md) |

## Repository layout

| Path              | Role                               |
| ----------------- | ---------------------------------- |
| `apps/web`        | Platform web application           |
| `apps/api`        | Platform API service               |
| `packages/shared` | Shared types across apps           |
| `docs/`           | Internal contributor documentation |

## Getting started

```bash
pnpm install
pnpm dev
```

- Web: `http://localhost:5181`
- API health: `http://localhost:3000/health`
- API docs: `http://localhost:3000/docs`
- Built-in super admin: `admin@morya.local` / `admin123` (created when the user table is empty; has every permission)

Copy `apps/api/.env.example` to `apps/api/.env` to override database and port settings. An empty database creates `users`, `roles`, `user_roles`, `role_permissions`, `sessions`, and `login_events` automatically.

## Contributing

Day-to-day setup, scripts, and commit conventions are documented for maintainers in:

- **[Development guide](./docs/DEVELOPMENT.md)**
- [Commit convention](./docs/COMMIT_CONVENTION.md)
