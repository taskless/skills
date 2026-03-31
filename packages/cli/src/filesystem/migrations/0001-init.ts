import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { addToGitignore } from "../gitignore";
import type { Migration } from "../types";

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

const migration: Migration = async (directory) => {
  // Always write README.md (overwrite stale content from older versions)
  await writeFile(join(directory, "README.md"), README_CONTENT, "utf8");

  // Ensure .gitignore has required entries
  const cwd = join(directory, "..");
  await addToGitignore(cwd, [".env.local.json", "sgconfig.yml"]);

  // Create subdirectories
  await mkdir(join(directory, "rules"), { recursive: true });
  await mkdir(join(directory, "rule-tests"), { recursive: true });
};

export default migration;
