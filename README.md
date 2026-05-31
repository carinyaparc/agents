# carinyaparc/agents

Autonomous agents that operate across the Carinya Parc platform. Each agent is a discrete, independently deployable service with its own identity and credentials.

## Agents

| Agent | Status | Responsibility |
|-------|--------|----------------|
| `sre` | Active | Sentry alerts → Claude triage → GitHub Issues on `carinyaparc/website` |
| `fix` | Planned | Read `agent-queue` issues, branch, commit, open PR |
| `review` | Planned | Orchestrate PR review |
| `deploy` | Planned | Post-deploy smoke tests and rollback |

## Development

```bash
pnpm install
pnpm typecheck
pnpm lint
```

See [docs/solution.md](docs/solution.md) for architecture and [docs/structure.md](docs/structure.md) for repository layout.
