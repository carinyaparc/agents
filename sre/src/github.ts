import { GitHubClient } from "@carinyaparc/shared/github";
import {
  formatIssueBody,
  sentryIssueMarker,
  triageLabels,
  type TriageResult,
} from "./schema.js";

export interface GitHubRepoOptions {
  token: string;
  owner: string;
  repo: string;
}

export interface CreateTriageIssueOptions extends GitHubRepoOptions {
  sentryIssueId: string;
  result: TriageResult;
}

export async function findTriageIssueForSentry(
  options: GitHubRepoOptions & { sentryIssueId: string },
): Promise<{ number: number; url: string } | null> {
  const client = new GitHubClient({ token: options.token });
  const marker = sentryIssueMarker(options.sentryIssueId);
  // closed issues are excluded intentionally — a recurrence should open a new issue
  const query = `repo:${options.owner}/${options.repo} "${marker}" is:issue is:open`;
  const issues = await client.searchIssues(query);
  return issues[0] ?? null;
}

export async function createTriageIssue(
  options: CreateTriageIssueOptions,
): Promise<{ number: number; url: string }> {
  const client = new GitHubClient({ token: options.token });

  return client.createIssue({
    owner: options.owner,
    repo: options.repo,
    title: `[${options.result.severity}] ${options.result.summary}`,
    body: formatIssueBody(options.result, options.sentryIssueId),
    labels: triageLabels(options.result),
  });
}
