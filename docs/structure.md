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

GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_REPO_OWNER=carinyaparc
GITHUB_REPO_NAME=website

CLAUDE_API_KEY=
```

---

## Labels required on `carinyaparc/website`

Set up once in GitHub repo settings before first run:

```
bug
agent-queue
needs-human
```

Issue type `Bug` and the org **Priority** field (`Urgent` / `High` / `Medium` / `Low`) are set via the GitHub API — not as labels. The agent resolves the Priority field by name from the org identified by `GITHUB_REPO_OWNER`.

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

GitHub App: `carinya-agents` (org-owned, installed on target repos)
Permissions on `carinyaparc/website`: **Issues — Read and Write** only.