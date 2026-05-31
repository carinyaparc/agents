import type { SentryAlertContext } from "./schema.js";

const SENTRY_API_URL = "https://sentry.io/api/0";

type SentryEvent = {
  entries: Array<{
    type: string;
    data?: { values?: Array<{ stacktrace?: { frames?: unknown[] } }> };
  }>;
};

type SentryIssue = {
  id: string;
  title: string;
  culprit?: string;
  level: string;
  count: string;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  firstRelease?: {
    lastCommit?: {
      id?: string;
    };
  };
};

export interface SentryClientOptions {
  token: string;
  orgSlug: string;
  projectSlug: string;
}

export class SentryClient {
  private readonly token: string;
  private readonly orgSlug: string;
  private readonly projectSlug: string;

  constructor(options: SentryClientOptions) {
    this.token = options.token;
    this.orgSlug = options.orgSlug;
    this.projectSlug = options.projectSlug;
  }

  async fetchAlertContext(issueId: string): Promise<SentryAlertContext> {
    const issue = await this.get<SentryIssue>(
      `/projects/${this.orgSlug}/${this.projectSlug}/issues/${issueId}/`,
    );

    const event = await this.get<SentryEvent>(`/issues/${issueId}/events/latest/`);
    const stackTrace = formatStackTrace(event);

    return {
      issueId: issue.id,
      title: issue.title,
      culprit: issue.culprit,
      level: issue.level,
      count: Number(issue.count),
      userCount: issue.userCount,
      firstSeen: issue.firstSeen,
      lastSeen: issue.lastSeen,
      stackTrace,
      suspectCommit: issue.firstRelease?.lastCommit?.id,
    };
  }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${SENTRY_API_URL}${path}`, {
      headers: {
        authorization: `Bearer ${this.token}`,
        accept: "application/json",
      },
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Sentry API error (${response.status}): ${detail}`);
    }

    return response.json() as Promise<T>;
  }
}

function formatStackTrace(event: unknown): string {
  if (!event || typeof event !== "object") {
    return "_No stack trace available_";
  }

  const entries = (event as { entries?: unknown[] }).entries;
  if (!Array.isArray(entries)) {
    return "_No stack trace available_";
  }

  const exception = entries.find((entry) => {
    return typeof entry === "object" && entry !== null && (entry as { type?: string }).type === "exception";
  }) as { data?: { values?: Array<{ stacktrace?: { frames?: Array<Record<string, unknown>> } }> } } | undefined;

  const frames = exception?.data?.values?.[0]?.stacktrace?.frames ?? [];
  const topFrames = frames.slice(-5).reverse();

  if (topFrames.length === 0) {
    return "_No stack trace available_";
  }

  return topFrames
    .map((frame) => {
      const filename = frame.filename ?? frame.abs_path ?? "unknown";
      const line = frame.lineNo ?? frame.lineno ?? "?";
      const fn = frame.function ?? "anonymous";
      return `at ${fn} (${filename}:${line})`;
    })
    .join("\n");
}
