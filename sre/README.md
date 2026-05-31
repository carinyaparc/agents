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

## GitHub App

The agent authenticates as an org-owned **GitHub App** (short-lived installation tokens), not a personal PAT.

### 1. Create the app

Go to https://github.com/organizations/carinyaparc/settings/apps/new (org GitHub App — not a Custom Integration).

| Setting | Value |
|---------|-------|
| GitHub App name | `carinya-agents` (or similar) |
| Homepage URL | `https://github.com/carinyaparc/agents` |
| Webhook | **Inactive** (Sentry sends webhooks to Vercel, not GitHub) |

**Repository permissions:**

| Permission | Access |
|------------|--------|
| Issues | Read and write |
| Metadata | Read-only (default) |

**Organization permissions:**

| Permission | Access |
|------------|--------|
| Issue fields | Read-only |

**Where can this app be installed?** Only on this account (`carinyaparc`).

Create the app, then **Generate a private key** (.pem download). Note the **App ID** on the same page.

### 2. Install on the org

From the app settings page → **Install App** → select **carinyaparc** → choose **Selected repositories** (start with `website`; add others as agents target them).

### 3. Configure env vars

| Variable | Source |
|----------|--------|
| `GITHUB_APP_ID` | App settings page |
| `GITHUB_APP_PRIVATE_KEY` | Contents of the `.pem` file |
| `GITHUB_REPO_OWNER` | `carinyaparc` |
| `GITHUB_REPO_NAME` | Target repo (e.g. `website`) |

On Vercel, paste the private key as a single line with `\n` for line breaks.

### Repo prerequisites

On each target repo (e.g. `website`):

- **Labels:** `bug`, `agent-queue`, `needs-human`
- **Issue type:** `Bug` (org-level)
- **Priority field:** org field named `Priority` (resolved automatically)

Severity maps to Priority: P1 → Urgent, P2 → High, P3 → Medium.

## Sentry webhook

Point the Sentry integration at the deployed `/api/webhook` URL and set `SENTRY_WEBHOOK_SECRET` to match.

The handler processes **issue alert** webhooks only (`Sentry-Hook-Resource: event_alert`, `action: triggered`). Other hook types (e.g. issue lifecycle) receive `204 No Content` and are not triaged.

## Idempotency

Before creating an issue, the agent searches for an open GitHub issue whose body contains a `carinya-sre:sentry-issue-id:` marker matching the Sentry issue ID. Closed issues are excluded on purpose — if the same error recurs after a fix, a new issue is opened.

**Known limitation:** GitHub's search API indexes issue content with a delay of roughly 30–60 seconds. If Sentry retries the webhook (or fires duplicate events) within that window, both deliveries may pass the idempotency check before the first issue is indexed, resulting in duplicate issues.
