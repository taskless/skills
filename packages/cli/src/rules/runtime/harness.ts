import { relative } from "node:path";

import type { CheckResult } from "../../types/check";
import type { Finding } from "../../types/runtime-rule";
import type { RuntimeRule } from "./discover";
import { runNarrow } from "./narrow";
import { DEFAULT_CHECK_TIMEOUT_MS, invokeCheck } from "./invoke";

/** Scanner-agnostic `source` label for runtime-rule findings. */
export const RUNTIME_SOURCE = "taskless-runtime";

/** Options controlling a runtime-rule run. */
export interface RuntimeRunOptions {
  /** Restrict the narrow to these paths (diff scope); empty scans the repo. */
  paths?: string[];
  /** Per-check wall-clock bound in ms. */
  timeoutMs?: number;
}

/**
 * Map a check `Finding` onto the scanner-agnostic `CheckResult`. `Finding`
 * line/column are 1-indexed (harness contract); `CheckResult.range` is 0-indexed
 * (ast-grep native — display and `--json` consumers add 1), so convert down.
 */
function findingToCheckResult(
  rule: RuntimeRule,
  finding: Finding
): CheckResult {
  const line = finding.line === undefined ? 0 : Math.max(0, finding.line - 1);
  const column =
    finding.column === undefined ? 0 : Math.max(0, finding.column - 1);
  return {
    source: RUNTIME_SOURCE,
    ruleId: rule.name,
    severity: finding.severity ?? "warning",
    message: finding.message,
    file: finding.file,
    range: { start: { line, column }, end: { line, column } },
    matchedText: "",
  };
}

/** A harness failure (throw / timeout / bad output) becomes one error finding. */
function harnessErrorResult(
  root: string,
  rule: RuntimeRule,
  message: string
): CheckResult {
  return {
    source: RUNTIME_SOURCE,
    ruleId: rule.name,
    severity: "error",
    message: `runtime rule ${rule.name} failed: ${message}`,
    file: relative(root, rule.checkFile),
    range: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
    matchedText: "",
  };
}

/**
 * Execute one runtime rule: run the ast-grep narrow, gate on matches (zero
 * matches ⇒ `check.ts` is never invoked), invoke `check.ts`, and map its
 * findings onto `CheckResult`. A harness failure is isolated to a single
 * error-severity finding and never throws.
 */
export async function executeRuntimeRule(
  root: string,
  rule: RuntimeRule,
  options: RuntimeRunOptions = {}
): Promise<CheckResult[]> {
  let matches;
  try {
    matches = await runNarrow(root, rule, options.paths ?? []);
  } catch (error) {
    return [
      harnessErrorResult(
        root,
        rule,
        `narrow failed: ${error instanceof Error ? error.message : String(error)}`
      ),
    ];
  }

  if (matches.length === 0) return []; // gate: no matches, no check

  const result = await invokeCheck(
    rule.checkFile,
    root,
    matches,
    options.timeoutMs ?? DEFAULT_CHECK_TIMEOUT_MS
  );
  if (result.status === "error") {
    return [harnessErrorResult(root, rule, result.message)];
  }
  return result.findings.map((finding) => findingToCheckResult(rule, finding));
}

/**
 * Execute runtime rules in sequence (process-per-check scheduling) and return
 * the aggregated findings. Sequential keeps `tsx` worker startup predictable;
 * the function contract leaves room for a pool later.
 */
export async function executeRuntimeRules(
  root: string,
  rules: RuntimeRule[],
  options: RuntimeRunOptions = {}
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const rule of rules) {
    results.push(...(await executeRuntimeRule(root, rule, options)));
  }
  return results;
}
