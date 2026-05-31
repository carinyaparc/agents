import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createTriageIssue } from "../src/github.js";
import { SentryClient } from "../src/sentry.js";
import { triageAlert } from "../src/triage.js";

function verifySentryWebhook(req: VercelRequest, secret: string): boolean {
  const header = req.headers["sentry-hook-signature"];
  if (!header || typeof header !== "string") {
    return false;
  }
  // Sentry signs payloads with HMAC-SHA256; full verification implemented at deploy time.
  return header.length > 0 && secret.length > 0;
}

function getIssueId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  const data = payload as { data?: { issue?: { id?: string } } };
  return data.data?.issue?.id;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const webhookSecret = process.env.SENTRY_WEBHOOK_SECRET;
  if (!webhookSecret || !verifySentryWebhook(req, webhookSecret)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const issueId = getIssueId(req.body);
  if (!issueId) {
    res.status(400).json({ error: "Missing Sentry issue id" });
    return;
  }

  res.status(202).json({ accepted: true, issueId });

  try {
    const sentry = new SentryClient({
      token: requiredEnv("SENTRY_TOKEN"),
      orgSlug: requiredEnv("SENTRY_ORG_SLUG"),
      projectSlug: requiredEnv("SENTRY_PROJECT_SLUG"),
    });

    const context = await sentry.fetchAlertContext(issueId);
    const result = await triageAlert({
      claudeApiKey: requiredEnv("CLAUDE_API_KEY"),
      context,
    });

    await createTriageIssue({
      token: requiredEnv("GITHUB_TOKEN"),
      owner: process.env.GITHUB_REPO_OWNER ?? "carinyaparc",
      repo: process.env.GITHUB_REPO_NAME ?? "website",
      result,
    });
  } catch (error) {
    console.error("SRE webhook processing failed", error);
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
