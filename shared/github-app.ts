import { createSign } from "node:crypto";

const GITHUB_API_URL = "https://api.github.com";

interface CachedInstallationToken {
  token: string;
  expiresAtMs: number;
}

const installationTokenCache = new Map<string, CachedInstallationToken>();

export interface GitHubAppCredentials {
  appId: string;
  privateKey: string;
}

export interface GitHubAppRepoTarget extends GitHubAppCredentials {
  owner: string;
  repo: string;
}

function normalizePrivateKey(privateKey: string): string {
  return privateKey.includes("\\n") ? privateKey.replace(/\\n/g, "\n") : privateKey;
}

function createAppJwt(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iat: now - 60,
      exp: now + 600,
      iss: appId,
    }),
  ).toString("base64url");
  const signInput = `${header}.${payload}`;
  const sign = createSign("RSA-SHA256");
  sign.update(signInput);
  sign.end();
  const signature = sign.sign(normalizePrivateKey(privateKey), "base64url");
  return `${signInput}.${signature}`;
}

async function githubAppFetch<T>(
  path: string,
  jwt: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${GITHUB_API_URL}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${jwt}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub App API error (${response.status}) ${path}: ${detail}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function getInstallationAccessToken(
  target: GitHubAppRepoTarget,
): Promise<string> {
  const cacheKey = `${target.appId}:${target.owner}/${target.repo}`;
  const cached = installationTokenCache.get(cacheKey);
  if (cached && cached.expiresAtMs > Date.now() + 60_000) {
    return cached.token;
  }

  const jwt = createAppJwt(target.appId, target.privateKey);
  const installation = await githubAppFetch<{ id: number }>(
    `/repos/${target.owner}/${target.repo}/installation`,
    jwt,
  );

  const tokenResponse = await githubAppFetch<{
    token: string;
    expires_at: string;
  }>(`/app/installations/${installation.id}/access_tokens`, jwt, {
    method: "POST",
  });

  installationTokenCache.set(cacheKey, {
    token: tokenResponse.token,
    expiresAtMs: Date.parse(tokenResponse.expires_at),
  });

  return tokenResponse.token;
}
