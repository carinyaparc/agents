import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogValue = string | number | boolean | null | undefined | SerializedError;

export interface LogFields {
  [key: string]: LogValue;
}

export interface TraceFields {
  traceId: string;
  requestId?: string;
  sentryIssueId?: string;
  repo?: string;
}

export interface SerializedError {
  name: string;
  message: string;
  code?: string;
  stack?: string;
  cause?: SerializedError;
}

const traceStore = new AsyncLocalStorage<Logger>();

export class Logger {
  private readonly base: TraceFields;

  constructor(base: TraceFields) {
    this.base = base;
  }

  get traceId(): string {
    return this.base.traceId;
  }

  child(fields: Partial<TraceFields>): Logger {
    return new Logger({ ...this.base, ...fields });
  }

  debug(message: string, fields?: LogFields): void {
    this.write("debug", message, fields);
  }

  info(message: string, fields?: LogFields): void {
    this.write("info", message, fields);
  }

  warn(message: string, fields?: LogFields): void {
    this.write("warn", message, fields);
  }

  error(message: string, error?: unknown, fields?: LogFields): void {
    this.write("error", message, {
      ...fields,
      ...(error !== undefined && { error: serializeError(error) }),
    });
  }

  async span<T>(name: string, fn: () => Promise<T>, fields?: LogFields): Promise<T> {
    const startedAt = Date.now();
    this.info("span.start", { span: name, ...fields });
    try {
      const result = await fn();
      this.info("span.end", {
        span: name,
        durationMs: Date.now() - startedAt,
        outcome: "ok",
        ...fields,
      });
      return result;
    } catch (error) {
      this.error("span.end", error, {
        span: name,
        durationMs: Date.now() - startedAt,
        outcome: "error",
        ...fields,
      });
      throw error;
    }
  }

  private write(level: LogLevel, message: string, fields?: LogFields): void {
    const entry = {
      ts: new Date().toISOString(),
      level,
      message,
      service: "carinya-sre",
      ...this.base,
      ...fields,
    };

    const line = JSON.stringify(entry);
    if (level === "error") {
      console.error(line);
      return;
    }
    if (level === "warn") {
      console.warn(line);
      return;
    }
    console.log(line);
  }
}

export function createTrace(fields: Partial<TraceFields> = {}): Logger {
  return new Logger({
    traceId: fields.traceId ?? randomUUID(),
    ...fields,
  });
}

export function getLogger(): Logger | undefined {
  return traceStore.getStore();
}

export function runWithTrace<T>(logger: Logger, fn: () => Promise<T>): Promise<T> {
  return traceStore.run(logger, fn);
}

export function serializeError(error: unknown): SerializedError {
  if (!(error instanceof Error)) {
    return { name: "Error", message: String(error) };
  }

  const cause = error.cause;
  const errno = (error as NodeJS.ErrnoException).code;

  return {
    name: error.name,
    message: error.message,
    ...(errno !== undefined && { code: errno }),
    ...(error.stack !== undefined && { stack: error.stack }),
    ...(cause !== undefined && { cause: serializeError(cause) }),
  };
}
