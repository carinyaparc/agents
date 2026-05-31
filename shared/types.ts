export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GitHubIssueFieldValue {
  field_id: number;
  value: string;
}

export interface GitHubIssueInput {
  owner: string;
  repo: string;
  title: string;
  body: string;
  labels: string[];
  type?: string;
  issueFieldValues?: GitHubIssueFieldValue[];
}
