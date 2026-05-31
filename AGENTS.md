# Agent development guide

This monorepo hosts autonomous agents for the Carinya Parc platform. Each agent lives in its own directory and deploys independently.

## Layout

| Path | Purpose |
|------|---------|
| `sre/` | Sentry webhook → triage → GitHub Issues on `carinyaparc/website` |
| `shared/` | Claude and GitHub clients reused across agents |

## Conventions

- TypeScript with strict mode; ESM (`"type": "module"`).
- Credentials only in Vercel env vars or local `.env` (never committed).
- Issue bodies created by agents must follow the contract in `sre/src/schema.ts`.
- Shared API wrappers belong in `shared/`; agent-specific orchestration stays under each agent's `src/`. The shared package compiles to `dist/` on install (`prepare`); run `pnpm build` after changing shared sources.

## Adding a new agent

1. Create `/<agent-name>/` with `api/`, `src/`, `vercel.json`, `.env.example`, and `README.md`.
2. Add the package to `pnpm-workspace.yaml`.
3. Depend on `@carinyaparc/shared` where Claude or GitHub are needed.
4. Document required GitHub labels and service account permissions in the agent README.

## Deployment

The SRE agent deploys from `sre/` as Vercel project `carinya-sre` (region `syd1`). See `sre/README.md` for setup.
