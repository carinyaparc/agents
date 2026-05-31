export type Severity = "P1" | "P2" | "P3";

export type Category =
  | "JS error"
  | "API failure"
  | "performance"
  | "security";

export interface TriageResult {
  summary: string;
  severity: Severity;
  severityImpact: string;
  category: Category;
  error: string;
  file?: string;
  frequency: string;
  firstSeen: string;
  suspectCommit?: string;
  stackTrace: string;
  suggestedFix: string;
  fixable: boolean;
  scope: string;
  testRequired: boolean;
  testDescription?: string;
}

export interface SentryAlertContext {
  issueId: string;
  title: string;
  culprit?: string;
  level: string;
  count: number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  stackTrace: string;
  suspectCommit?: string;
}

export function formatIssueBody(result: TriageResult): string {
  const fileLine = result.file ?? "unknown";
  const suspect = result.suspectCommit ?? "unavailable";
  const testLine = result.testRequired
    ? `yes — ${result.testDescription ?? "see suggested fix"}`
    : "no";

  return `## Summary
${result.summary}

## Severity
${result.severity} — ${result.severityImpact}

## Category
${result.category}

## Context
- Error: ${result.error}
- File: ${fileLine}
- Frequency: ${result.frequency}
- First seen: ${result.firstSeen}
- Suspect commit: ${suspect}

## Stack trace
${result.stackTrace}

## Suggested fix
${result.suggestedFix}

## Agent instructions
- Fixable: ${result.fixable ? "yes" : "no"}
- Scope: ${result.scope}
- Test required: ${testLine}`;
}

export function triageLabels(result: TriageResult): string[] {
  const severity = result.severity.toLowerCase();
  const queue = result.fixable ? "agent-queue" : "needs-human";
  return ["bug", severity, queue];
}
