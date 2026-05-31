import { GitHubClient } from "@carinyaparc/shared/github";
import {
  formatIssueBody,
  triageLabels,
  type TriageResult,
} from "./schema.js";

export interface CreateTriageIssueOptions {
  token: string;
  owner: string;
  repo: string;
  result: TriageResult;
}

export async function createTriageIssue(
  options: CreateTriageIssueOptions,
): Promise<{ number: number; url: string }> {
  const client = new GitHubClient({ token: options.token });

  return client.createIssue({
    owner: options.owner,
    repo: options.repo,
    title: `[${options.result.severity}] ${options.result.summary}`,
    body: formatIssueBody(options.result),
    labels: triageLabels(options.result),
  });
}
