import type { GitHubIssueInput } from "./types.js";

const GITHUB_API_URL = "https://api.github.com";

export interface GitHubClientOptions {
  token: string;
}

export class GitHubClient {
  private readonly token: string;

  constructor(options: GitHubClientOptions) {
    this.token = options.token;
  }

  async createIssue(input: GitHubIssueInput): Promise<{ number: number; url: string }> {
    const response = await fetch(
      `${GITHUB_API_URL}/repos/${input.owner}/${input.repo}/issues`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.token}`,
          accept: "application/vnd.github+json",
          "content-type": "application/json",
          "x-github-api-version": "2022-11-28",
        },
        body: JSON.stringify({
          title: input.title,
          body: input.body,
          labels: input.labels,
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`GitHub API error (${response.status}): ${detail}`);
    }

    const data = (await response.json()) as { number: number; html_url: string };
    return { number: data.number, url: data.html_url };
  }
}
