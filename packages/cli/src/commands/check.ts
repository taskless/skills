import { resolve, join, isAbsolute, relative } from "node:path";
import { readdir, stat } from "node:fs/promises";
import { defineCommand } from "citty";

import { runAstGrepScan } from "../rules/scan";
import type { CheckResult } from "../types/check";
import { formatText } from "../util/format";
import { generateSgConfig } from "../filesystem/sgconfig";
import { getTelemetry } from "../telemetry";
import { outputSchema as checkOutputSchema } from "../schemas/check";
import { makeErrorEnvelope } from "../types/errors";
import { getToken } from "../auth/token";
import { resolveRepositoryUrl } from "../util/git-remote";
import { getCliPrefix } from "../util/package-manager";
import { reconcile, type ReconcileResponse } from "../api/reconcile";
import {
  RUN_RULES_DIR,
  materializeRunDirectory,
  selectRunFiles,
  signRuleFiles,
  type SignedRuleFile,
} from "../rules/run-set";

async function pathExists(absolutePath: string): Promise<boolean> {
  try {
    await stat(absolutePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve each positional path against cwd and filter out any that don't
 * exist on disk. Returns a list of paths relative to cwd so `sg scan` can
 * be spawned from cwd and use those paths directly.
 */
async function filterExistingPaths(
  cwd: string,
  rawPaths: string[]
): Promise<string[]> {
  const resolvedCwd = resolve(cwd);
  const kept: string[] = [];
  for (const rawPath of rawPaths) {
    const absolutePath = isAbsolute(rawPath)
      ? resolve(rawPath)
      : resolve(resolvedCwd, rawPath);
    if (!(await pathExists(absolutePath))) continue;
    const relativePath = relative(resolvedCwd, absolutePath);
    // Reject paths that escape cwd (e.g. `../outside-project`) so `sg scan`
    // never traverses outside the project directory.
    const escapesCwd =
      relativePath === ".." ||
      relativePath.startsWith(`..${"/"}`) ||
      relativePath.startsWith(`..${"\\"}`) ||
      isAbsolute(relativePath);
    if (escapesCwd) continue;
    kept.push(relativePath === "" ? "." : relativePath);
  }
  return kept;
}

/**
 * Extract positional arguments from rawArgs. citty's rawArgs contains the
 * original argv for this subcommand, so we drop anything starting with `-`
 * and drop known flag values (e.g. `-d <value>`). Once `--` is seen, all
 * remaining arguments are treated as positional paths (conventional POSIX
 * end-of-options marker), which lets users pass paths that begin with `-`.
 */
function extractPositionalPaths(rawArguments: string[]): string[] {
  const paths: string[] = [];
  let afterDoubleDash = false;
  for (let index = 0; index < rawArguments.length; index++) {
    const argument = rawArguments[index]!;
    if (afterDoubleDash) {
      paths.push(argument);
      continue;
    }
    if (argument === "--") {
      afterDoubleDash = true;
      continue;
    }
    if (argument.startsWith("-")) {
      // Skip value for short/long flags that take a value
      if (
        (argument === "-d" || argument === "--dir") &&
        index + 1 < rawArguments.length
      ) {
        index += 1;
      }
      continue;
    }
    paths.push(argument);
  }
  return paths;
}

/**
 * How `check` will scan, decided from auth state:
 * - `local`: unauthenticated or `--anonymous` — scan all local rules silently.
 * - `degrade`: authenticated but reconciliation could not complete — scan all
 *   local rules and warn that verification could not be performed.
 * - `gated`: reconciliation succeeded — scan only the blessed `run` set.
 */
type ScanMode =
  | { kind: "local" }
  | { kind: "degrade"; reason: string }
  | { kind: "gated"; result: ReconcileResponse; signed: SignedRuleFile[] };

async function resolveScanMode(
  cwd: string,
  anonymous: boolean,
  ruleFiles: string[]
): Promise<ScanMode> {
  if (anonymous) return { kind: "local" };

  const token = await getToken(cwd, { silent: true });
  if (!token) return { kind: "local" };

  let repositoryUrl: string;
  try {
    repositoryUrl = await resolveRepositoryUrl(cwd);
  } catch {
    return {
      kind: "degrade",
      reason: "no GitHub remote was found, so rules could not be verified",
    };
  }

  const signed = await signRuleFiles(cwd, ruleFiles);
  const outcome = await reconcile(token, {
    repositoryUrl,
    files: signed.map(({ file, signature }) => ({ file, signature })),
  });

  if (outcome.status === "ok") {
    return { kind: "gated", result: outcome.result, signed };
  }
  if (outcome.status === "unauthorized") {
    return {
      kind: "degrade",
      reason: `authentication was rejected — run \`${getCliPrefix()} auth login\` to re-authenticate`,
    };
  }
  return {
    kind: "degrade",
    reason: `the rule service was unavailable (${outcome.reason})`,
  };
}

/** Emit advisory reconciliation warnings (human output only). */
function surfaceReconcileWarnings(
  result: ReconcileResponse,
  warn: (message: string) => void
): void {
  for (const entry of result.unsafe) {
    warn(
      `Warning: ${entry.file} differs from the blessed rule (tamper/drift) and will not run.`
    );
  }
  for (const entry of result.unknown) {
    warn(
      `Notice: ${entry.file} was not issued by the server and will not run.`
    );
  }
  for (const entry of result.missing) {
    warn(
      `Notice: expected rule ${entry.ruleId} (${entry.file}) is not present locally.`
    );
  }
}

export const checkCommand = defineCommand({
  meta: {
    name: "check",
    description: "Run Taskless rules against your codebase",
  },
  args: {
    dir: {
      type: "string",
      alias: "d",
      description: "Working directory",
    },
    json: {
      type: "boolean",
      description: "Output as JSON",
      default: false,
    },
    anonymous: {
      type: "boolean",
      description: "Skip server reconciliation and scan local rules unverified",
      default: false,
    },
  },
  async run({ args, rawArgs }) {
    const cwd = resolve(args.dir ?? process.cwd());
    const telemetry = await getTelemetry(cwd);

    // Warnings are advisory human output; suppress them under --json so the
    // machine output stays the existing { success, results } shape.
    const warn = (message: string) => {
      if (!args.json) console.error(message);
    };

    // Set when a scan actually runs; drives cli_check_completed with counts
    // only (never matched code).
    let scanCounts:
      | { errorCount: number; warningCount: number; findings: number }
      | undefined;
    try {
      const positionalPaths = extractPositionalPaths(rawArgs);
      const hadExplicitPaths = positionalPaths.length > 0;
      const existingPaths = hadExplicitPaths
        ? await filterExistingPaths(cwd, positionalPaths)
        : [];

      // If the user passed paths but none exist (e.g. all-deleted diff),
      // exit cleanly with empty results rather than falling back to a full scan.
      if (hadExplicitPaths && existingPaths.length === 0) {
        if (args.json) {
          console.log(
            JSON.stringify(
              checkOutputSchema.parse({ success: true, results: [] })
            )
          );
        }
        return;
      }

      // Check for rule files
      const rulesDirectory = join(cwd, ".taskless", "rules");
      let ruleFiles: string[] = [];
      try {
        const entries = await readdir(rulesDirectory);
        ruleFiles = entries.filter((f) => f.endsWith(".yml"));
      } catch {
        // .taskless/ or rules/ directory doesn't exist
      }

      if (ruleFiles.length === 0) {
        if (args.json) {
          console.log(
            JSON.stringify(
              checkOutputSchema.parse({ success: true, results: [] })
            )
          );
        } else {
          console.log(
            "No rules configured. Create one with `taskless rule create`."
          );
        }
        return;
      }

      // Decide what to run from auth state, then scan.
      try {
        const mode = await resolveScanMode(cwd, args.anonymous, ruleFiles);

        let results: CheckResult[] = [];
        if (mode.kind === "gated") {
          surfaceReconcileWarnings(mode.result, warn);
          const runFiles = selectRunFiles(mode.signed, mode.result.run);
          // Empty run set (empty corpus, or all unsafe/unknown): run nothing.
          if (runFiles.length > 0) {
            await materializeRunDirectory(cwd, runFiles);
            await generateSgConfig(cwd, { rulesDirectory: RUN_RULES_DIR });
            const scan = await runAstGrepScan(cwd, existingPaths);
            results = scan.results;
          }
        } else {
          if (mode.kind === "degrade") {
            warn(
              `Notice: ${mode.reason}. Scanning all local rules unverified; the CI backstop enforces the server-owned rule set.`
            );
          }
          await generateSgConfig(cwd);
          const scan = await runAstGrepScan(cwd, existingPaths);
          results = scan.results;
        }

        let errorCount = 0;
        let warningCount = 0;
        for (const result of results) {
          if (result.severity === "error") errorCount++;
          else if (result.severity === "warning") warningCount++;
        }
        const hasErrors = errorCount > 0;
        scanCounts = { errorCount, warningCount, findings: results.length };

        // Format output
        if (args.json) {
          const output = checkOutputSchema.parse({
            success: !hasErrors,
            results,
          });
          console.log(JSON.stringify(output));
        } else {
          console.log(formatText(results));
        }

        // Exit code: 1 if any errors, 0 otherwise
        if (hasErrors) {
          process.exitCode = 1;
        }
      } catch (error) {
        const message = `Error: ${error instanceof Error ? error.message : String(error)}`;
        if (args.json) {
          console.log(
            JSON.stringify(makeErrorEnvelope("SCAN_FAILED", message))
          );
        } else {
          console.error(message);
        }
        process.exitCode = 1;
      }
    } finally {
      // Concrete state event: a scan completed; counts only, no matched code.
      if (scanCounts) {
        telemetry.capture("cli_check_completed", scanCounts);
      }
    }
  },
});
