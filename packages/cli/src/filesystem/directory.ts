import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { runMigrations } from "./migrate";

/**
 * Ensure the .taskless/ directory exists and is up-to-date by running
 * any pending migrations. Safe to call repeatedly — returns immediately
 * if already current.
 */
export async function ensureTasklessDirectory(cwd: string): Promise<void> {
  const tasklessDirectory = join(cwd, ".taskless");
  await mkdir(tasklessDirectory, { recursive: true });
  await runMigrations(tasklessDirectory);
}
