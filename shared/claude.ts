import type { ClaudeMessage } from "./types.js";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-6";

export interface ClaudeClientOptions {
  apiKey: string;
  model?: string;
}

export interface ClaudeCompletionOptions {
  system: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
}

export class ClaudeClient {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(options: ClaudeClientOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_MODEL;
  }

  async complete(options: ClaudeCompletionOptions): Promise<string> {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options.maxTokens ?? 1024,
        system: options.system,
        messages: options.messages,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Claude API error (${response.status}): ${detail}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text?: string }>;
    };

    const text = data.content.find((block) => block.type === "text")?.text;
    if (!text) {
      throw new Error("Claude API returned no text content");
    }

    return text;
  }
}
