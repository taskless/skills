import { resolve, join, isAbsolute, relative } from "node:path";
import { readdir, stat } from "node:fs/promises";
import { defineCommand } from "citty";

import { runAstGrepScan } from "../rules/scan";
import { formatText } from "../util/format";
import { generateSgConfig } from "../filesystem/sgconfig";
import { printSchema } from "../util/schema-output";
import { getTelemetry } from "../telemetry";
import {
  outputSchema as checkOutputSchema,
  errorSchema as checkErrorSchema,
} from "../schemas/check";

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
 * and drop known flag values (e.g. `-d <value>`).
 */
function extractPositionalPaths(rawArguments: string[]): string[] {
  const paths: string[] = [];
  for (let index = 0; index < rawArguments.length; index++) {
    const argument = rawArguments[index]!;
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
    schema: {
      type: "boolean",
      description: "Print input/output/error JSON Schemas and exit",
      default: false,
    },
  },
  async run({ args, rawArgs }) {
    // --schema short-circuits: print schemas and exit
    if (args.schema) {
      printSchema({
        output: checkOutputSchema,
        error: checkErrorSchema,
      });
      return;
    }

    const cwd = resolve(args.dir ?? process.cwd());
    const telemetry = await getTelemetry(cwd);
    telemetry.capture("cli_check");

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
          "No rules configured. Create one with `taskless rules create`."
        );
      }
      return;
    }

    // Generate ephemeral sgconfig.yml and run scanner
    try {
      await generateSgConfig(cwd);
      const { results } = await runAstGrepScan(cwd, existingPaths);
      const hasErrors = results.some((r) => r.severity === "error");

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
        const output = checkErrorSchema.parse({
          success: false,
          error: message,
          results: [],
        });
        console.log(JSON.stringify(output));
      } else {
        console.error(message);
      }
      process.exitCode = 1;
    }
  },
});
