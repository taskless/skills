import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const GITIGNORE_ENTRIES = [".env.local.json", "sgconfig.yml"];

/**
 * Ensure `.taskless/.gitignore` exists and contains required entries.
 * Creates the file if missing; appends missing entries if it already exists.
 */
export async function ensureTasklessGitignore(cwd: string): Promise<void> {
  const tasklessDirectory = join(cwd, ".taskless");
  const gitignorePath = join(tasklessDirectory, ".gitignore");

  await mkdir(tasklessDirectory, { recursive: true });

  let existing = "";
  try {
    existing = await readFile(gitignorePath, "utf8");
  } catch {
    // File doesn't exist yet
  }

  const lines = new Set(
    existing
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  );

  const missing = GITIGNORE_ENTRIES.filter((entry) => !lines.has(entry));
  if (missing.length === 0) return;

  const suffix = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  const content = existing + suffix + missing.join("\n") + "\n";

  await writeFile(gitignorePath, content, "utf8");
}
