import type { GitHubIssueInput } from "./types.js";
import {
  getInstallationAccessToken,
  type GitHubAppRepoTarget,
} from "./github-app.js";

const GITHUB_API_URL = "https://api.github.com";

const issueFieldIdCache = new Map<string, number>();

export interface GitHubClientOptions {
  token: string;
}

export class GitHubClient {
  private readonly token: string;

  constructor(options: GitHubClientOptions) {
    this.token = options.token;
  }

  static async forRepo(target: GitHubAppRepoTarget): Promise<GitHubClient> {
    const token = await getInstallationAccessToken(target);
    return new GitHubClient({ token });
  }

  async getOrgIssueFieldId(org: string, fieldName: string): Promise<number> {
    const cacheKey = `${org}:${fieldName}`;
    const cached = issueFieldIdCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const response = await fetch(`${GITHUB_API_URL}/orgs/${org}/issue-fields`, {
      headers: {
        authorization: `Bearer ${this.token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
      },
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`GitHub issue fields API error (${response.status}): ${detail}`);
    }

    const fields = (await response.json()) as Array<{ id: number; name: string }>;
    const field = fields.find((entry) => entry.name === fieldName);
    if (!field) {
      throw new Error(`Org issue field not found: ${fieldName}`);
    }

    issueFieldIdCache.set(cacheKey, field.id);
    return field.id;
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
          ...(input.type !== undefined && { type: input.type }),
          ...(input.issueFieldValues !== undefined && {
            issue_field_values: input.issueFieldValues,
          }),
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

  async searchIssues(
    query: string,
  ): Promise<Array<{ number: number; url: string }>> {
    const response = await fetch(
      `${GITHUB_API_URL}/search/issues?q=${encodeURIComponent(query)}`,
      {
        headers: {
          authorization: `Bearer ${this.token}`,
          accept: "application/vnd.github+json",
          "x-github-api-version": "2022-11-28",
        },
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`GitHub search API error (${response.status}): ${detail}`);
    }

    const data = (await response.json()) as {
      items: Array<{ number: number; html_url: string }>;
    };

    return data.items.map((item) => ({
      number: item.number,
      url: item.html_url,
    }));
  }
}
