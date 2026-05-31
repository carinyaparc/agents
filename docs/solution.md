# Solution architecture — carinyaparc/agents

## Overview

`carinyaparc/agents` is a monorepo of autonomous agents that operate across the Carinya Parc platform. Each agent is a discrete, independently deployable service with its own identity, credentials, and responsibility.

The first agent — `sre` — closes the loop between production observability (Sentry) and the development pipeline (GitHub), without human intervention.

---

## System context

```
Sentry (observe)
      │
      │ webhook
      ▼
carinya-sre-agent (Vercel serverless)
      │
      ├── Sentry API     → fetch enriched context
      ├── Claude API     → classify + structure
      └── GitHub API     → create issue
                               │
                               │ label: agent-queue
                               ▼
                        carinyaparc/website
                        GitHub Issues
                               │
                        fix agent (future)
```

---

## SRE agent — responsibilities

| Responsibility | Description |
|---|---|
| Receive | Accept Sentry alert webhooks |
| Enrich | Fetch stack trace, frequency, suspect commits from Sentry API |
| Classify | Call Claude API to determine severity, category, and agent-fixability |
| Create | Open a structured GitHub Issue on `carinyaparc/website` |
| Label | Apply labels: `bug`, `agent-queue` or `needs-human`; set issue type `Bug` and Priority field (P1→Urgent, P2→High, P3→Medium) |
| Document | Confluence page per P1 incident (future) |

---

## SRE agent — issue contract

Every GitHub Issue created by `carinya-sre-agent` follows this schema:

```markdown
## Summary
[Claude-generated one-sentence description]

## Severity
[P1 / P2 / P3] — [brief impact statement]

## Category
[JS error / API failure / performance / security]

## Context
- Error: [message]
- File: [path:line]
- Frequency: [N events / N users in last Xh]
- First seen: [UTC timestamp]
- Suspect commit: [sha] (if available)

## Stack trace
[top 5 frames]

## Suggested fix
[Claude-generated, 1–2 sentences]

## Agent instructions
- Fixable: [yes / no]
- Scope: [description]
- Test required: [yes / no + what]
```

---

## Identity and access

| Service account | Credential | Scope |
|---|---|---|
| `carinya-agents` (GitHub App) | `GITHUB_APP_ID` + `GITHUB_APP_PRIVATE_KEY` | Issues write on target repos; Issue fields read on org |
| `carinya-sre-agent` | `SENTRY_TOKEN` | Read-only on Carinya Parc Sentry project |
| `carinya-sre-agent` | `CLAUDE_API_KEY` | Claude API (claude-sonnet-4-6) |

All credentials stored as Vercel environment variables. Not in source.

---

## Deployment

| Concern | Decision |
|---|---|
| Host | Vercel serverless function |
| Trigger | HTTPS webhook (Sentry → Vercel endpoint) |
| Region | Sydney (ap-southeast-2) |
| Timeout | 30s (Sentry webhooks expect fast ACK; processing async) |
| Authentication | Sentry webhook secret verified on every request |

---

## Future agents

| Agent | Responsibility |
|---|---|
| `fix` | Read `agent-queue` issues, branch, commit, open PR |
| `review` | Orchestrate PR review across CodeRabbit + Copilot |
| `deploy` | Post-deploy smoke test and rollback trigger |