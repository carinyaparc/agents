import { getLogger } from "./logger.js";

function isRetryableNetworkError(error: unknown): boolean {
  if (!(error instanceof TypeError) || error.message !== "fetch failed") {
    return false;
  }
  const cause = (error as { cause?: { code?: string } }).cause;
  return cause?.code === "ETIMEDOUT" || cause?.code === "ECONNRESET" || cause?.code === "ENOTFOUND";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options?: { retries?: number; label?: string },
): Promise<Response> {
  const retries = options?.retries ?? 3;
  const label = options?.label ?? url;
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.status >= 500 && attempt < retries) {
        await sleep(500 * attempt);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (isRetryableNetworkError(error) && attempt < retries) {
        getLogger()?.warn("fetch.retry", {
          label,
          attempt,
          retries,
          error: error instanceof Error ? error.message : String(error),
        });
        await sleep(500 * attempt);
        continue;
      }
      if (error instanceof Error) {
        throw new Error(`${label}: ${error.message}`, { cause: error });
      }
      throw error;
    }
  }

  if (lastError instanceof Error) {
    throw new Error(`${label}: ${lastError.message}`, { cause: lastError });
  }
  throw lastError;
}
