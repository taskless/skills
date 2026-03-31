import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { ensureTasklessDirectory } from "./bootstrap";

const SGCONFIG_CONTENT = `ruleDirs:
  - rules
testConfigs:
  - testDir: rule-tests
`;

/**
 * Generate an ephemeral `sgconfig.yml` in `.taskless/` for ast-grep.
 * Runs migrations and ensures the directory structure is up-to-date.
 */
export async function generateSgConfig(cwd: string): Promise<void> {
  await ensureTasklessDirectory(cwd);
  await writeFile(
    join(cwd, ".taskless", "sgconfig.yml"),
    SGCONFIG_CONTENT,
    "utf8"
  );
}
