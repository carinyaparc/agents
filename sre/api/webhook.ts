import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GitHubClient } from "@carinyaparc/shared/github";
import { createTrace, runWithTrace } from "@carinyaparc/shared/logger";
import { createHmac, timingSafeEqual } from "node:crypto";
import { buffer } from "node:stream/consumers";
import { createTriageIssue, findTriageIssueForSentry } from "../src/github.js";
import { SentryClient } from "../src/sentry.js";
import { triageAlert } from "../src/triage.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

function verifySentryWebhook(body: string, header: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const headerBuf = Buffer.from(header);
  const expectedBuf = Buffer.from(expected);
  if (headerBuf.length !== expectedBuf.length) {
    return false;
  }
  return timingSafeEqual(headerBuf, expectedBuf);
}

function getHeader(req: VercelRequest, name: string): string | undefined {
  const value = req.headers[name];
  if (typeof value === "string") {
    return value;
  }
  return Array.isArray(value) ? value[0] : undefined;
}

function getIssueId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  const data = payload as {
    data?: {
      issue?: { id?: string };
      event?: { issue_id?: string };
    };
  };
  return data.data?.event?.issue_id ?? data.data?.issue?.id;
}

function isTriageWebhook(req: VercelRequest, payload: unknown): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const resource = getHeader(req, "sentry-hook-resource");
  const action = (payload as { action?: string }).action;
  return resource === "event_alert" && action === "triggered";
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const requestId = getHeader(req, "request-id");
  const log = createTrace({ requestId });

  if (req.method !== "POST") {
    log.warn("webhook.rejected", { reason: "method_not_allowed", method: req.method });
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const rawBody = (await buffer(req)).toString("utf8");

  const webhookSecret = process.env.SENTRY_WEBHOOK_SECRET;
  const signature = req.headers["sentry-hook-signature"];
  if (
    !webhookSecret ||
    typeof signature !== "string" ||
    !verifySentryWebhook(rawBody, signature, webhookSecret)
  ) {
    log.warn("webhook.rejected", { reason: "unauthorized" });
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    log.warn("webhook.rejected", { reason: "invalid_json" });
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  const hookResource = getHeader(req, "sentry-hook-resource");
  const action = (payload as { action?: string }).action;

  if (!isTriageWebhook(req, payload)) {
    log.info("webhook.ignored", {
      hookResource: hookResource ?? null,
      action: action ?? null,
    });
    res.status(204).end();
    return;
  }

  const issueId = getIssueId(payload);
  if (!issueId) {
    log.warn("webhook.rejected", { reason: "missing_issue_id", hookResource, action });
    res.status(400).json({ error: "Missing Sentry issue id" });
    return;
  }

  const owner = process.env.GITHUB_REPO_OWNER ?? "carinyaparc";
  const repo = process.env.GITHUB_REPO_NAME ?? "website";
  const trace = log.child({ sentryIssueId: issueId, repo: `${owner}/${repo}` });

  trace.info("webhook.accepted", { hookResource, action });
  res.status(202).json({ accepted: true, issueId, traceId: trace.traceId });

  await runWithTrace(trace, async () => {
    const startedAt = Date.now();
    try {
      const github = await trace.span("github.app_auth", () =>
        GitHubClient.forRepo({
          appId: requiredEnv("GITHUB_APP_ID"),
          privateKey: requiredEnv("GITHUB_APP_PRIVATE_KEY"),
          owner,
          repo,
        }),
      );

      const existing = await trace.span("github.idempotency_search", () =>
        findTriageIssueForSentry({
          client: github,
          owner,
          repo,
          sentryIssueId: issueId,
        }),
      );

      if (existing) {
        trace.info("triage.duplicate_skipped", {
          githubIssueNumber: existing.number,
          githubIssueUrl: existing.url,
          durationMs: Date.now() - startedAt,
        });
        return;
      }

      const sentry = new SentryClient({
        token: requiredEnv("SENTRY_TOKEN"),
        orgSlug: requiredEnv("SENTRY_ORG_SLUG"),
        projectSlug: requiredEnv("SENTRY_PROJECT_SLUG"),
      });

      const context = await trace.span("sentry.enrich", () =>
        sentry.fetchAlertContext(issueId),
      );

      const result = await trace.span("claude.triage", () =>
        triageAlert({
          claudeApiKey: requiredEnv("CLAUDE_API_KEY"),
          context,
        }),
      );

      const created = await trace.span("github.create_issue", () =>
        createTriageIssue({
          client: github,
          owner,
          repo,
          sentryIssueId: issueId,
          result,
        }),
      );

      trace.info("triage.complete", {
        githubIssueNumber: created.number,
        githubIssueUrl: created.url,
        severity: result.severity,
        fixable: result.fixable,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      trace.error("triage.failed", error, { durationMs: Date.now() - startedAt });
    }
  });
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
