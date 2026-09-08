# Wise Kit Studio

[English](./README.md) · [中文](./README.zh-CN.md)

**Wise Kit Studio** is a monorepo scaffold for a visual design platform. Product requirements are not finalized yet; the repository currently ships an empty frontend page and a minimal API shell.

The web app uses **[Wise Kit UI](https://github.com/wise-kit/wise-kit-ui)** via a local link to the sibling `../wise-kit-ui` checkout.

| Resource        | Link                                                                                    |
| --------------- | --------------------------------------------------------------------------------------- |
| Source (GitHub) | [wise-kit/wise-kit-studio](https://github.com/wise-kit/wise-kit-studio)         |
| UI library      | [wise-kit/wise-kit-ui](https://github.com/wise-kit/wise-kit-ui) · [Docs](https://wise-kit.github.io/wise-kit-ui/) |
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
