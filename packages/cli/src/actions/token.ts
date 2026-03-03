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
    const data = JSON.parse(raw) as { access_token?: string };
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
  // eslint-disable-next-line unicorn/no-null -- JSON.stringify requires null as replacer
  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", {
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
