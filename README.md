# Wex Design Studio

[English](./README.md) · [中文](./README.zh-CN.md)

**Wex Design Studio** is a monorepo scaffold for a visual design platform. Product requirements are not finalized yet; the repository currently ships an empty frontend page and a minimal API shell.

The web app uses **[Roost Design UI](https://github.com/roost-design/roost-design-ui)** via a local link to the sibling `../wex-design-ui` checkout.

| Resource        | Link                                                                                    |
| --------------- | --------------------------------------------------------------------------------------- |
| Source (GitHub) | [wex-design/wex-design-studio](https://github.com/wex-design/wex-design-studio)         |
| UI library      | [roost-design/roost-design-ui](https://github.com/roost-design/roost-design-ui) · [Docs](https://roost-design.github.io/roost-design-ui/) |
| Contributors    | [Development guide](./docs/DEVELOPMENT.md)                                              |

## Repository layout

| Path              | Role                     |
| ----------------- | ------------------------ |
| `apps/web`        | Platform web application |
| `apps/api`        | Platform API service     |
| `packages/shared` | Shared types across apps |
| `docs/`           | Internal contributor documentation |

## Getting started

```bash
pnpm install
pnpm dev
```

- Web: `http://localhost:5181`
- API health: `http://localhost:3000/health`
- API docs: `http://localhost:3000/docs`

## Contributing

Day-to-day setup, scripts, and commit conventions are documented for maintainers in:

- **[Development guide](./docs/DEVELOPMENT.md)**
- [Commit convention](./docs/COMMIT_CONVENTION.md)
