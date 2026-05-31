# SRE agent (`carinya-sre`)

Receives Sentry alert webhooks, enriches context from the Sentry API, classifies via Claude, and opens structured GitHub Issues on `carinyaparc/website`.

## Flow

1. `api/webhook.ts` — verify webhook, ACK fast (202), process async
2. `src/sentry.ts` — stack trace, frequency, suspect commits
3. `src/triage.ts` — severity, category, fixability
4. `src/github.ts` — issue body + labels (`bug`, `p1`/`p2`/`p3`, `agent-queue` or `needs-human`)

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

On `carinyaparc/website`, create labels: `bug`, `p1`, `p2`, `p3`, `agent-queue`, `needs-human`.

Service account `carinya-sre-agent` needs **Issues — Read and Write** on that repo.

## Sentry webhook

Point the Sentry integration at the deployed `/api/webhook` URL and set `SENTRY_WEBHOOK_SECRET` to match.

## Idempotency

Before creating an issue, the agent searches for an open GitHub issue whose body contains a `carinya-sre:sentry-issue-id:` marker matching the Sentry issue ID. Closed issues are excluded on purpose — if the same error recurs after a fix, a new issue is opened.

**Known limitation:** GitHub's search API indexes issue content with a delay of roughly 30–60 seconds. If Sentry retries the webhook (or fires duplicate events) within that window, both deliveries may pass the idempotency check before the first issue is indexed, resulting in duplicate issues.
