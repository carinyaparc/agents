# SRE agent (`carinya-sre`)

Receives Sentry alert webhooks, enriches context from the Sentry API, classifies via Claude, and opens structured GitHub Issues on `carinyaparc/website`.

## Flow

1. `api/webhook.ts` — verify webhook, ACK fast (202), process async
2. `src/sentry.ts` — stack trace, frequency, suspect commits
3. `src/triage.ts` — severity, category, fixability
4. `src/github.ts` — issue body, type `Bug`, Priority field, labels (`bug`, `agent-queue` or `needs-human`)

## Local setup

```bash
cp .env.example .env
# Fill in values (never commit .env)
pnpm install
```

## Vercel

| Setting | Value |
|---------|-------|
| Project name | `carinya-sre` |
| Root directory | `sre/` |
| Framework | Other |
| Region | `syd1` |

Copy env vars from `.env.example` into the Vercel project settings.

## GitHub prerequisites

On `carinyaparc/website`:

- **Labels:** `bug`, `agent-queue`, `needs-human` (create `agent-queue` and `needs-human` if not present)
- **Issue type:** `Bug` (org-level, already configured)
- **Priority field:** org-level field named `Priority` — resolved automatically via `GITHUB_REPO_OWNER`

Severity maps to the Priority field: P1 → Urgent, P2 → High, P3 → Medium. Issue fields are org-scoped, so the same Priority field applies to any repo under that org.

Service account `carinya-sre-agent` needs **Issues — Read and Write** on that repo.

## Sentry webhook

Point the Sentry integration at the deployed `/api/webhook` URL and set `SENTRY_WEBHOOK_SECRET` to match.

The handler processes **issue alert** webhooks only (`Sentry-Hook-Resource: event_alert`, `action: triggered`). Other hook types (e.g. issue lifecycle) receive `204 No Content` and are not triaged.

## Idempotency

Before creating an issue, the agent searches for an open GitHub issue whose body contains a `carinya-sre:sentry-issue-id:` marker matching the Sentry issue ID. Closed issues are excluded on purpose — if the same error recurs after a fix, a new issue is opened.

**Known limitation:** GitHub's search API indexes issue content with a delay of roughly 30–60 seconds. If Sentry retries the webhook (or fires duplicate events) within that window, both deliveries may pass the idempotency check before the first issue is indexed, resulting in duplicate issues.
