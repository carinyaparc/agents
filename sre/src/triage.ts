import { ClaudeClient } from "@carinyaparc/shared/claude";
import type { SentryAlertContext, TriageResult } from "./schema.js";

const TRIAGE_SYSTEM_PROMPT = `You are an SRE triage agent for the Carinya Parc platform.
Analyze the Sentry alert context and respond with JSON only (no markdown fences).
Schema:
{
  "summary": "one sentence",
  "severity": "P1" | "P2" | "P3",
  "severityImpact": "brief impact statement",
  "category": "JS error" | "API failure" | "performance" | "security",
  "suggestedFix": "1-2 sentences",
  "fixable": boolean,
  "scope": "what an automated fix agent could change",
  "testRequired": boolean,
  "testDescription": "optional, when testRequired is true"
}`;

export interface TriageOptions {
  claudeApiKey: string;
  context: SentryAlertContext;
}

export async function triageAlert(options: TriageOptions): Promise<TriageResult> {
  const client = new ClaudeClient({ apiKey: options.claudeApiKey });
  const { context } = options;

  const userPrompt = JSON.stringify({
    title: context.title,
    level: context.level,
    culprit: context.culprit,
    count: context.count,
    userCount: context.userCount,
    firstSeen: context.firstSeen,
    lastSeen: context.lastSeen,
    stackTrace: context.stackTrace,
    suspectCommit: context.suspectCommit,
  });

  const raw = await client.complete({
    system: TRIAGE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const parsed = JSON.parse(raw) as Omit<
    TriageResult,
    "error" | "file" | "frequency" | "firstSeen" | "suspectCommit" | "stackTrace"
  >;

  const hours = Math.max(
    1,
    Math.round(
      (Date.parse(context.lastSeen) - Date.parse(context.firstSeen)) / (1000 * 60 * 60),
    ),
  );

  return {
    ...parsed,
    error: context.title,
    file: context.culprit,
    frequency: `${context.count} events / ${context.userCount} users in last ${hours}h`,
    firstSeen: context.firstSeen,
    suspectCommit: context.suspectCommit,
    stackTrace: context.stackTrace,
  };
}
