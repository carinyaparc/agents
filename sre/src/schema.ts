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

export const SENTRY_ISSUE_MARKER_PREFIX = "carinya-sre:sentry-issue-id:";

export function sentryIssueMarker(sentryIssueId: string): string {
  return `${SENTRY_ISSUE_MARKER_PREFIX}${sentryIssueId}`;
}

export function formatIssueBody(result: TriageResult, sentryIssueId: string): string {
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
- Test required: ${testLine}

<!-- ${sentryIssueMarker(sentryIssueId)} -->`;
}

export const GITHUB_PRIORITY_FIELD_NAME = "Priority";

export type GitHubPriority = "Urgent" | "High" | "Medium" | "Low";

export interface TriageIssueMetadata {
  labels: string[];
  type: "Bug";
  priority: GitHubPriority;
}

const SEVERITY_TO_PRIORITY: Record<Severity, GitHubPriority> = {
  P1: "Urgent",
  P2: "High",
  P3: "Medium",
};

export function triageIssueMetadata(result: TriageResult): TriageIssueMetadata {
  const queue = result.fixable ? "agent-queue" : "needs-human";
  return {
    labels: ["bug", queue],
    type: "Bug",
    priority: SEVERITY_TO_PRIORITY[result.severity],
  };
}
