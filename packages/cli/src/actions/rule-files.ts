import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { stringify } from "yaml";

import type { GeneratedRule } from "./rule-api";

/** Write a generated rule's content to .taskless/rules/{kebab-id}.yml */
export async function writeRuleFile(
  cwd: string,
  rule: GeneratedRule
): Promise<string> {
  const directory = join(cwd, ".taskless", "rules");
  await mkdir(directory, { recursive: true });
  const filePath = join(directory, `${rule.id}.yml`);
  await writeFile(filePath, stringify(rule.content), "utf8");
  return filePath;
}

/** Write a rule's test cases to .taskless/rule-tests/{kebab-id}-{timestamp}-test.yml */
export async function writeRuleTestFile(
  cwd: string,
  rule: GeneratedRule,
  timestamp: string
): Promise<string> {
  const directory = join(cwd, ".taskless", "rule-tests");
  await mkdir(directory, { recursive: true });
  const filePath = join(directory, `${rule.id}-${timestamp}-test.yml`);
  const content = {
    id: rule.id,
    valid: rule.tests?.valid ?? [],
    invalid: rule.tests?.invalid ?? [],
  };
  await writeFile(filePath, stringify(content), "utf8");
  return filePath;
}

/** Delete a rule file and any matching test files. Returns whether the rule file existed. */
export async function deleteRuleFiles(
  cwd: string,
  id: string
): Promise<boolean> {
  const rulesDirectory = join(cwd, ".taskless", "rules");
  const ruleFilePath = join(rulesDirectory, `${id}.yml`);

  let ruleExisted = false;
  try {
    await rm(ruleFilePath);
    ruleExisted = true;
  } catch {
    return false;
  }

  // Remove matching test files
  const testDirectory = join(cwd, ".taskless", "rule-tests");
  try {
    const entries = await readdir(testDirectory);
    const matchingTests = entries.filter(
      (f) => f.startsWith(`${id}-`) && f.endsWith("-test.yml")
    );
    await Promise.all(
      matchingTests.map((f) => rm(join(testDirectory, f)).catch(() => {}))
    );
  } catch {
    // rule-tests directory doesn't exist, nothing to clean up
  }

  return ruleExisted;
}
