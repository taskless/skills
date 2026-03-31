import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";

import { ensureTasklessGitignore } from "./gitignore";

export type Migration = (directory: string) => Promise<undefined>;
export type Migrations = Record<string, Migration>;

interface TasklessManifest {
  version: number;
}

const MANIFEST_FILE = "taskless.json";

async function readManifest(directory: string): Promise<TasklessManifest> {
  try {
    const content = await readFile(join(directory, MANIFEST_FILE), "utf8");
    return JSON.parse(content) as TasklessManifest;
  } catch {
    return { version: 0 };
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

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

// --- Migrations ---

const README_CONTENT = `# Taskless

This directory contains [Taskless](https://taskless.io) configuration and rules for static analysis.

## Usage

Run the Taskless scanner from your repository root:

\`\`\`sh
# npm / pnpm
pnpm dlx @taskless/cli@latest check

# npx
npx @taskless/cli@latest check
\`\`\`

## Files

- \`taskless.json\` - Version manifest / migration state
- \`.env.local.json\` - Local authentication credentials (git-ignored)
- \`rules/\` - Generated ast-grep rules (managed by Taskless)
- \`rule-tests/\` - Rule tests containing pass/fail examples for your rules
`;

const migrations: Migrations = {
  "001-init": async (directory: string): Promise<undefined> => {
    // Create README.md if missing
    const readmePath = join(directory, "README.md");
    if (!(await fileExists(readmePath))) {
      await writeFile(readmePath, README_CONTENT, "utf8");
    }

    // Ensure .gitignore has required entries
    // ensureTasklessGitignore expects the repo root (parent of .taskless/)
    const cwd = join(directory, "..");
    await ensureTasklessGitignore(cwd);

    // Create subdirectories
    await mkdir(join(directory, "rules"), { recursive: true });
    await mkdir(join(directory, "rule-tests"), { recursive: true });

    return undefined;
  },
};

// --- Bootstrap ---

/**
 * Ensure the .taskless/ directory exists and is up-to-date by running
 * any pending migrations. Safe to call repeatedly — returns immediately
 * if already current.
 */
export async function ensureTasklessDirectory(cwd: string): Promise<void> {
  const tasklessDirectory = join(cwd, ".taskless");
  await mkdir(tasklessDirectory, { recursive: true });

  const manifest = await readManifest(tasklessDirectory);
  const migrationEntries = Object.entries(migrations);
  const total = migrationEntries.length;

  if (manifest.version >= total) {
    return;
  }

  const pending = migrationEntries.slice(manifest.version);
  for (const [name, migrate] of pending) {
    console.error(`Running migration: ${name}`);
    await migrate(tasklessDirectory);
  }

  await writeManifest(tasklessDirectory, { version: total });
}
