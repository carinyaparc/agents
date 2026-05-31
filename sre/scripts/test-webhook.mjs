#!/usr/bin/env node
/**
 * Post-deploy smoke and integration tests for the SRE webhook.
 *
 * Usage:
 *   node --env-file=.env.local scripts/test-webhook.mjs
 *   node --env-file=.env.local scripts/test-webhook.mjs --issue-id 1234567890
 *   node --env-file=.env.local scripts/test-webhook.mjs --fetch-issue
 */

import { createHmac } from "node:crypto";

const DEFAULT_BASE_URL = "https://agents-ecru-seven.vercel.app";

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    issueId: undefined,
    fetchIssue: false,
    secret: process.env.SENTRY_WEBHOOK_SECRET,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--base-url") {
      options.baseUrl = argv[++i]?.replace(/\/$/, "");
    } else if (arg === "--issue-id") {
      options.issueId = argv[++i];
    } else if (arg === "--fetch-issue") {
      options.fetchIssue = true;
    } else if (arg === "--secret") {
      options.secret = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Post-deploy tests for the SRE webhook.

Options:
  --base-url URL     Deployment root (default: ${DEFAULT_BASE_URL})
  --issue-id ID      Sentry issue id for a full end-to-end test
  --fetch-issue      Pick the most recent issue from Sentry API (needs SENTRY_TOKEN, org/project slugs)
  --secret VALUE     Webhook secret (default: SENTRY_WEBHOOK_SECRET env)

Examples:
  node --env-file=.env.local scripts/test-webhook.mjs
  node --env-file=.env.local scripts/test-webhook.mjs --fetch-issue
  node --env-file=.env.local scripts/test-webhook.mjs --issue-id 1234567890
`);
}

function signBody(body, secret) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

async function request(baseUrl, { method = "GET", headers = {}, body } = {}) {
  const response = await fetch(`${baseUrl}/api/webhook`, {
    method,
    headers,
    body,
  });
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  return { status: response.status, text, json };
}

async function fetchLatestSentryIssueId() {
  const token = process.env.SENTRY_TOKEN;
  const org = process.env.SENTRY_ORG_SLUG;
  const project = process.env.SENTRY_PROJECT_SLUG;
  if (!token || !org || !project) {
    throw new Error(
      "SENTRY_TOKEN, SENTRY_ORG_SLUG, and SENTRY_PROJECT_SLUG are required for --fetch-issue",
    );
  }

  const url = `https://sentry.io/api/0/projects/${org}/${project}/issues/?query=is:unresolved&limit=1`;
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Sentry API error (${response.status}): ${detail}`);
  }

  const issues = await response.json();
  const issueId = issues[0]?.id;
  if (!issueId) {
    throw new Error("No unresolved issues found in the Sentry project");
  }

  return String(issueId);
}

function eventAlertPayload(issueId) {
  return JSON.stringify({
    action: "triggered",
    data: {
      event: {
        issue_id: issueId,
        title: "SRE webhook post-deploy test",
      },
      triggered_rule: "Post-deploy test",
    },
  });
}

function issueLifecyclePayload(issueId) {
  return JSON.stringify({
    action: "created",
    data: {
      issue: { id: issueId },
    },
  });
}

async function runCase(name, fn) {
  process.stdout.write(`- ${name} ... `);
  try {
    const result = await fn();
    console.log(`PASS (${result})`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`FAIL — ${message}`);
    return false;
  }
}

function assertStatus(actual, expected, detail) {
  if (actual !== expected) {
    throw new Error(`expected HTTP ${expected}, got ${actual}${detail ? ` — ${detail}` : ""}`);
  }
  return `HTTP ${actual}`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const webhookUrl = `${options.baseUrl}/api/webhook`;

  console.log(`Testing ${webhookUrl}\n`);

  let passed = 0;
  let total = 0;

  const run = async (name, fn) => {
    total += 1;
    if (await runCase(name, fn)) {
      passed += 1;
    }
  };

  await run("GET returns 405", async () => {
    const { status } = await request(options.baseUrl, { method: "GET" });
    return assertStatus(status, 405);
  });

  await run("POST without signature returns 401", async () => {
    const { status } = await request(options.baseUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    return assertStatus(status, 401);
  });

  if (!options.secret) {
    console.log("\nSkipping signed tests — set SENTRY_WEBHOOK_SECRET or pass --secret");
    console.log(`\n${passed}/${total} passed`);
    process.exit(passed === total ? 0 : 1);
  }

  await run("Wrong hook resource returns 204", async () => {
    const body = issueLifecyclePayload("smoke-test");
    const { status } = await request(options.baseUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "sentry-hook-resource": "issue",
        "sentry-hook-signature": signBody(body, options.secret),
      },
      body,
    });
    return assertStatus(status, 204);
  });

  let issueId = options.issueId;
  if (options.fetchIssue) {
    issueId = await fetchLatestSentryIssueId();
    console.log(`\nUsing latest Sentry issue: ${issueId}\n`);
  }

  if (issueId) {
    await run("event_alert with valid signature returns 202", async () => {
      const body = eventAlertPayload(issueId);
      const { status, json, text } = await request(options.baseUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "sentry-hook-resource": "event_alert",
          "sentry-hook-signature": signBody(body, options.secret),
        },
        body,
      });
      return assertStatus(status, 202, json ? JSON.stringify(json) : text);
    });

    console.log(`
End-to-end request accepted. The handler returns 202 before background work finishes.

Next checks:
  1. Vercel → project → Logs (look for errors in the last few minutes)
  2. GitHub → carinyaparc/website → Issues (new issue with type Bug + Priority set)
  3. Issue body should contain: carinya-sre:sentry-issue-id:${issueId}

Re-running with the same issue id should skip creation once GitHub search indexes the marker (~30–60s).
`);
  } else {
    console.log(`
Signed routing tests passed. For a full end-to-end test, pass a real Sentry issue id:

  node --env-file=.env.local scripts/test-webhook.mjs --issue-id YOUR_SENTRY_ISSUE_ID

Or auto-pick the latest unresolved issue:

  node --env-file=.env.local scripts/test-webhook.mjs --fetch-issue
`);
  }

  console.log(`${passed}/${total} passed`);
  process.exit(passed === total ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
