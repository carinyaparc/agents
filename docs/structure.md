# Project structure — carinyaparc/agents

## Repository

```
carinyaparc/agents
```

## Directory structure

```
agents/
├── sre/                          # SRE agent — Sentry → Claude → GitHub Issues
│   ├── api/
│   │   └── webhook.ts            # Vercel serverless function (Sentry webhook receiver)
│   ├── src/
│   │   ├── sentry.ts             # Sentry API client — fetch enriched alert context
│   │   ├── triage.ts             # Claude API call — classify, score, structure
│   │   ├── github.ts             # GitHub API client — create issue
│   │   └── schema.ts             # Issue contract type definitions
│   ├── vercel.json               # Vercel project config
│   ├── .env.example              # Required env vars (no values)
│   └── README.md                 # Agent runbook
│
├── shared/                       # Shared utilities (used by all agents)
│   ├── claude.ts                 # Claude API wrapper
│   ├── github.ts                 # GitHub API base client
│   └── types.ts                  # Shared types
│
├── .github/
│   └── workflows/
│       └── ci.yml                # Lint + type check on PR
│
├── package.json                  # pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.json
├── AGENTS.md
└── README.md
```

---

## Key files

| File | Purpose |
|---|---|
| `sre/api/webhook.ts` | Entry point. Receives Sentry webhook, verifies secret, kicks off triage |
| `sre/src/sentry.ts` | Fetches enriched context: stack trace, frequency, suspect commits |
| `sre/src/triage.ts` | Calls Claude API. Returns severity, category, fixability, suggested fix |
| `sre/src/github.ts` | Creates GitHub Issue on `carinyaparc/website` with structured body + labels |
| `sre/src/schema.ts` | `TriageResult` type — the contract between triage and issue creation |
| `shared/claude.ts` | Shared Claude client (reused when fix and review agents are added) |
| `sre/.env.example` | Documents required secrets without exposing values |

---

## Environment variables

```
# sre/.env.example

SENTRY_TOKEN=
SENTRY_PROJECT_SLUG=
SENTRY_ORG_SLUG=
SENTRY_WEBHOOK_SECRET=

GITHUB_TOKEN=
GITHUB_REPO_OWNER=carinyaparc
GITHUB_REPO_NAME=website

CLAUDE_API_KEY=
```

---

## Labels required on `carinyaparc/website`

Set up once in GitHub repo settings before first run:

```
bug
p1
p2
p3
agent-queue
needs-human
```

---

## Vercel project

| Setting | Value |
|---|---|
| Project name | `carinya-sre` |
| Root directory | `sre/` |
| Framework | Other |
| Function region | `syd1` |

---

## Service account

GitHub account: `carinya-sre-agent`
Permissions on `carinyaparc/website`: **Issues — Read and Write** only.