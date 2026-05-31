export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GitHubIssueInput {
  owner: string;
  repo: string;
  title: string;
  body: string;
  labels: string[];
}
