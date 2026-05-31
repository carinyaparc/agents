import type { VercelRequest, VercelResponse } from "@vercel/node";
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

  const rawBody = (await buffer(req)).toString("utf8");

  const webhookSecret = process.env.SENTRY_WEBHOOK_SECRET;
  const signature = req.headers["sentry-hook-signature"];
  if (
    !webhookSecret ||
    typeof signature !== "string" ||
    !verifySentryWebhook(rawBody, signature, webhookSecret)
  ) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  const issueId = getIssueId(payload);
  if (!issueId) {
    res.status(400).json({ error: "Missing Sentry issue id" });
    return;
  }

  res.status(202).json({ accepted: true, issueId });

  try {
    const owner = process.env.GITHUB_REPO_OWNER ?? "carinyaparc";
    const repo = process.env.GITHUB_REPO_NAME ?? "website";
    const token = requiredEnv("GITHUB_TOKEN");

    const existing = await findTriageIssueForSentry({
      token,
      owner,
      repo,
      sentryIssueId: issueId,
    });
    if (existing) {
      console.info(
        `Skipping duplicate issue for Sentry ${issueId}: #${existing.number} ${existing.url}`,
      );
      return;
    }

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
      token,
      owner,
      repo,
      sentryIssueId: issueId,
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
