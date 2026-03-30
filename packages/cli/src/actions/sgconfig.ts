import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { ensureTasklessGitignore } from "./gitignore";

const SGCONFIG_CONTENT = `ruleDirs:
  - rules
testConfigs:
  - testDir: rule-tests
`;

/**
 * Generate an ephemeral `sgconfig.yml` in `.taskless/` for ast-grep.
 * Ensures the gitignore is in place so the generated file is not committed.
 */
export async function generateSgConfig(cwd: string): Promise<void> {
  const tasklessDirectory = join(cwd, ".taskless");
  await mkdir(tasklessDirectory, { recursive: true });
  await ensureTasklessGitignore(cwd);
  await writeFile(
    join(tasklessDirectory, "sgconfig.yml"),
    SGCONFIG_CONTENT,
    "utf8"
  );
}
