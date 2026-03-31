import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

import { parse } from "yaml";

import {
  astGrepRuleSchema,
  TASKLESS_REQUIRED_FIELDS,
  findRegexWithoutKind,
} from "../schemas/ast-grep-rule";
import { generateSgConfig } from "../filesystem/sgconfig";
import { findSgBinary, buildPath } from "./scan";
import astGrepJsonSchema from "../generated/ast-grep-rule-schema.json";
import { RULE_EXAMPLES } from "./verify-examples";

// --- Types ---

interface LayerResult {
  valid: boolean;
  errors: string[];
}

interface TestLayerResult extends LayerResult {
  passed: number;
  failed: number;
}

export interface VerifyResult {
  success: boolean;
  ruleId: string;
  schema: LayerResult;
  requirements: LayerResult;
  tests: TestLayerResult;
}

// --- Schema mode ---

export function getSchemaPayload(): Record<string, unknown> {
  return {
    astGrepSchema: astGrepJsonSchema,
    tasklessRequirements: {
      requiredFields: [...TASKLESS_REQUIRED_FIELDS],
      rules: [
        {
          name: "regex-requires-kind",
          description:
            "Rules using `regex` in any position must also specify `kind` at the same level. Without kind, regex matches against node text which is ambiguous and slow.",
        },
      ],
    },
    examples: RULE_EXAMPLES,
  };
}

// --- Layer 1: Schema validation ---

function validateSchema(ruleData: unknown): LayerResult {
  const result = astGrepRuleSchema.safeParse(ruleData);
  if (result.success) {
    return { valid: true, errors: [] };
  }
  const errors = result.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`
  );
  return { valid: false, errors };
}

// --- Layer 2: Taskless requirements ---

async function validateRequirements(
  cwd: string,
  ruleId: string,
  ruleData: Record<string, unknown>
): Promise<LayerResult> {
  const errors: string[] = [];

  // Check required fields
  for (const field of TASKLESS_REQUIRED_FIELDS) {
    if (
      !(field in ruleData) ||
      ruleData[field] === undefined ||
      ruleData[field] === null ||
      ruleData[field] === ""
    ) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Check regex-requires-kind
  const ruleObject = ruleData.rule;
  if (
    ruleObject &&
    typeof ruleObject === "object" &&
    !Array.isArray(ruleObject)
  ) {
    errors.push(...findRegexWithoutKind(ruleObject as Record<string, unknown>));
  }

  // Check test file exists
  const testDirectory = join(cwd, ".taskless", "rule-tests");
  let hasTestFile = false;
  try {
    const entries = await readdir(testDirectory);
    hasTestFile = entries.some(
      (f) => f.startsWith(`${ruleId}-`) && f.endsWith("-test.yml")
    );
  } catch {
    // directory doesn't exist
  }
  if (!hasTestFile) {
    errors.push(
      `No test file found for rule "${ruleId}" in .taskless/rule-tests/`
    );
  }

  return { valid: errors.length === 0, errors };
}

// --- Layer 3: Test execution ---

async function runTests(cwd: string): Promise<TestLayerResult> {
  await generateSgConfig(cwd);

  const sgBinary = findSgBinary();
  const useShell = sgBinary === "sg";

  return new Promise((resolve) => {
    const child = spawn(
      sgBinary,
      ["test", "--config", ".taskless/sgconfig.yml"],
      {
        shell: useShell,
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, PATH: buildPath() },
      }
    );

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk.toString());
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk.toString());
    });

    child.on("error", () => {
      resolve({
        valid: false,
        errors: ["ast-grep (sg) binary not found. Is @ast-grep/cli installed?"],
        passed: 0,
        failed: 0,
      });
    });

    child.on("close", (code) => {
      const output = stdoutChunks.join("") + stderrChunks.join("");

      // Parse pass/fail counts from sg test output
      // sg test outputs lines like "passed: 3" and "failed: 0"
      const passedMatch = /(\d+)\s+passed/i.exec(output);
      const failedMatch = /(\d+)\s+failed/i.exec(output);
      const passed = passedMatch ? Number(passedMatch[1]) : 0;
      const failed = failedMatch ? Number(failedMatch[1]) : 0;

      if (code === 0) {
        resolve({ valid: true, errors: [], passed, failed });
      } else {
        const errors: string[] = [];
        if (failed > 0) {
          errors.push(`${String(failed)} test case(s) failed`);
        }
        const stderr = stderrChunks.join("").trim();
        if (stderr && failed === 0) {
          errors.push(stderr);
        }
        resolve({ valid: false, errors, passed, failed });
      }
    });
  });
}

// --- Main verify ---

export async function verifyRule(
  cwd: string,
  ruleId: string
): Promise<VerifyResult> {
  const rulePath = join(cwd, ".taskless", "rules", `${ruleId}.yml`);

  let ruleContent: string;
  try {
    ruleContent = await readFile(rulePath, "utf8");
  } catch {
    return {
      success: false,
      ruleId,
      schema: {
        valid: false,
        errors: [`Rule file not found: .taskless/rules/${ruleId}.yml`],
      },
      requirements: {
        valid: false,
        errors: ["Cannot check requirements: rule file not found"],
      },
      tests: {
        valid: false,
        errors: ["Cannot run tests: rule file not found"],
        passed: 0,
        failed: 0,
      },
    };
  }

  let ruleData: unknown;
  try {
    ruleData = parse(ruleContent);
  } catch (error) {
    const message = `Invalid YAML: ${error instanceof Error ? error.message : String(error)}`;
    return {
      success: false,
      ruleId,
      schema: { valid: false, errors: [message] },
      requirements: {
        valid: false,
        errors: ["Cannot check requirements: invalid YAML"],
      },
      tests: {
        valid: false,
        errors: ["Cannot run tests: invalid YAML"],
        passed: 0,
        failed: 0,
      },
    };
  }

  // Layer 1
  const schemaResult = validateSchema(ruleData);

  // Layer 2
  const requirementsResult = await validateRequirements(
    cwd,
    ruleId,
    (ruleData && typeof ruleData === "object" ? ruleData : {}) as Record<
      string,
      unknown
    >
  );

  // Layer 3 — only if test file exists (Layer 2 checks this)
  const hasTestFile = !requirementsResult.errors.some((error) =>
    error.includes("No test file found")
  );
  const testResult = hasTestFile
    ? await runTests(cwd)
    : {
        valid: false,
        errors: ["Skipped: no test file found"],
        passed: 0,
        failed: 0,
      };

  return {
    success: schemaResult.valid && requirementsResult.valid && testResult.valid,
    ruleId,
    schema: schemaResult,
    requirements: requirementsResult,
    tests: testResult,
  };
}
