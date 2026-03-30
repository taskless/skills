import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

import { ensureTasklessGitignore } from "./gitignore";

const AUTH_FILE = "auth.json";
const PER_REPO_AUTH_FILE = ".env.local.json";

/** Resolve the XDG-compliant config directory for taskless */
export function getConfigDirectory(): string {
  const xdgHome = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(xdgHome, "taskless");
}

/**
 * Resolve the current access token.
 * Priority: TASKLESS_TOKEN env var > per-repo .env.local.json > global auth.json
 */
export async function getToken(cwd?: string): Promise<string | undefined> {
  const envToken = process.env.TASKLESS_TOKEN;
  if (envToken) return envToken;

  // Per-repo token
  if (cwd) {
    const token = await readPerRepoToken(cwd);
    if (token) {
      await warnIfTracked(cwd);
      return token;
    }
  }

  // Global token
  try {
    const filePath = join(getConfigDirectory(), AUTH_FILE);
    const raw = await readFile(filePath, "utf8");
    const data = JSON.parse(raw) as {
      access_token?: string;
      expires_at?: number;
    };

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

/** Save token data to both per-repo and global locations */
export async function saveToken(
  data: {
    access_token: string;
    token_type?: string;
    expires_in?: number;
    refresh_token?: string;
  },
  cwd?: string
): Promise<void> {
  // Convert relative expires_in (seconds) to absolute expires_at (ms epoch)
  const persisted: Record<string, unknown> = { ...data };
  if (
    typeof data.expires_in === "number" &&
    Number.isFinite(data.expires_in) &&
    data.expires_in > 0
  ) {
    persisted.expires_at = Date.now() + data.expires_in * 1000;
  }

  const content = JSON.stringify(persisted, null, 2) + "\n";

  // Global XDG location
  const globalDirectory = getConfigDirectory();
  await mkdir(globalDirectory, { recursive: true });
  await writeFile(join(globalDirectory, AUTH_FILE), content, { mode: 0o600 });

  // Per-repo location
  if (cwd) {
    const tasklessDirectory = join(cwd, ".taskless");
    await mkdir(tasklessDirectory, { recursive: true });
    await ensureTasklessGitignore(cwd);
    await writeFile(join(tasklessDirectory, PER_REPO_AUTH_FILE), content, {
      mode: 0o600,
    });
  }
}

/** Remove saved tokens from both per-repo and global locations */
export async function removeToken(cwd?: string): Promise<boolean> {
  let removed = false;

  // Per-repo
  if (cwd) {
    try {
      await rm(join(cwd, ".taskless", PER_REPO_AUTH_FILE));
      removed = true;
    } catch {
      // File doesn't exist
    }
  }

  // Global
  try {
    await rm(join(getConfigDirectory(), AUTH_FILE));
    removed = true;
  } catch {
    // File doesn't exist
  }

  return removed;
}

async function readPerRepoToken(cwd: string): Promise<string | undefined> {
  try {
    const filePath = join(cwd, ".taskless", PER_REPO_AUTH_FILE);
    const raw = await readFile(filePath, "utf8");
    const data = JSON.parse(raw) as {
      access_token?: string;
      expires_at?: number;
    };

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

/** Warn if .env.local.json is tracked by git */
async function warnIfTracked(cwd: string): Promise<void> {
  const relativePath = ".taskless/.env.local.json";
  try {
    const output = await new Promise<string>((resolve, reject) => {
      execFile("git", ["ls-files", relativePath], { cwd }, (error, stdout) => {
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(stdout.trim());
      });
    });
    if (output.length > 0) {
      console.error(
        "Warning: .taskless/.env.local.json is tracked by git. This file contains authentication tokens and should be gitignored."
      );
    }
  } catch {
    // git not available or not a repo — skip the check
  }
}
