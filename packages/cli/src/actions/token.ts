import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

const AUTH_FILE = "auth.json";

/** Resolve the XDG-compliant config directory for taskless */
export function getConfigDirectory(): string {
  const xdgHome = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(xdgHome, "taskless");
}

/**
 * Resolve the current access token.
 * TASKLESS_TOKEN env var takes precedence over the file-based token.
 */
export async function getToken(): Promise<string | undefined> {
  const envToken = process.env.TASKLESS_TOKEN;
  if (envToken) return envToken;

  try {
    const filePath = join(getConfigDirectory(), AUTH_FILE);
    const raw = await readFile(filePath, "utf8");
    const data = JSON.parse(raw) as {
      access_token?: string;
      expires_at?: number;
    };

    // If a valid numeric expiry timestamp is stored, check it
    const expiresAt = data.expires_at;
    if (
      typeof expiresAt === "number" &&
      Number.isFinite(expiresAt) &&
      Date.now() >= expiresAt
    ) {
      return undefined;
    }

    return data.access_token;
  } catch {
    return undefined;
  }
}

/** Save token data to auth.json with 0600 permissions */
export async function saveToken(data: {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
}): Promise<void> {
  const directory = getConfigDirectory();
  await mkdir(directory, { recursive: true });
  const filePath = join(directory, AUTH_FILE);

  // Convert relative expires_in (seconds) to absolute expires_at (ms epoch)
  const persisted: Record<string, unknown> = { ...data };
  if (
    typeof data.expires_in === "number" &&
    Number.isFinite(data.expires_in) &&
    data.expires_in > 0
  ) {
    persisted.expires_at = Date.now() + data.expires_in * 1000;
  }

  await writeFile(filePath, JSON.stringify(persisted, null, 2) + "\n", {
    mode: 0o600,
  });
}

/** Remove the saved token file */
export async function removeToken(): Promise<boolean> {
  try {
    const filePath = join(getConfigDirectory(), AUTH_FILE);
    await rm(filePath);
    return true;
  } catch {
    return false;
  }
}
