# GitHub issue contract

Canonical implementation: `sre/src/schema.ts` (`TriageResult`, `formatIssueBody`).

Every issue created by the SRE agent uses this body shape:

## Summary
[One-sentence description]

## Severity
[P1 / P2 / P3] — [brief impact statement]

## Category
[JS error / API failure / performance / security]

## Context
- Error: [message]
- File: [path:line]
- Frequency: [N events / N users in last Xh]
- First seen: [UTC timestamp]
- Suspect commit: [sha] (if available)

## Stack trace
[top 5 frames]

## Suggested fix
[1–2 sentences]

## Agent instructions
- Fixable: [yes / no]
- Scope: [description]
- Test required: [yes / no + what]

<!-- carinya-sre:sentry-issue-id:[id] -->

The HTML comment at the end is machine-readable metadata for webhook idempotency (not shown prominently in the GitHub UI).
