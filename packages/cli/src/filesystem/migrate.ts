import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Migrations } from "./types";
import init from "./migrations/0001-init";

interface TasklessManifest {
  version: number;
}

const MANIFEST_FILE = "taskless.json";

const migrations: Migrations = {
  "1": init,
};

/** Sort migration keys numerically and return [version, migration] pairs */
function sortedMigrations(
  record: Migrations
): Array<[number, Migrations[string]]> {
  return Object.entries(record)
    .map(([key, value]) => [Number(key), value] as [number, Migrations[string]])
    .toSorted(([a], [b]) => a - b);
}

async function readManifest(directory: string): Promise<TasklessManifest> {
  try {
    const content = await readFile(join(directory, MANIFEST_FILE), "utf8");
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const version = Number(parsed.version);
    return { version: Number.isFinite(version) ? version : 0 };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return { version: 0 };
    }
    throw error;
  }
}

async function writeManifest(
  directory: string,
  manifest: TasklessManifest
): Promise<void> {
  await writeFile(
    join(directory, MANIFEST_FILE),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8"
  );
}

/**
 * Run any pending migrations against the .taskless/ directory.
 * Reads the current version from taskless.json and runs migrations
 * whose numeric key is greater than the current version.
 */
export async function runMigrations(tasklessDirectory: string): Promise<void> {
  const sorted = sortedMigrations(migrations);
  if (sorted.length === 0) return;

  const maxVersion = sorted.at(-1)![0];
  const manifest = await readManifest(tasklessDirectory);

  if (manifest.version >= maxVersion) {
    return;
  }

  const pending = sorted.filter(([version]) => version > manifest.version);
  console.error("Migrating to latest .taskless/ schema...");
  for (const [version, migrate] of pending) {
    try {
      await migrate(tasklessDirectory);
    } catch (error) {
      console.error(
        `Migration ${String(version)} failed: ${error instanceof Error ? error.message : String(error)}`
      );
      // Write manifest at last successful version so we don't re-run completed migrations
      if (version > manifest.version + 1) {
        await writeManifest(tasklessDirectory, { version: version - 1 });
      }
      throw error;
    }
  }

  await writeManifest(tasklessDirectory, { version: maxVersion });
}
