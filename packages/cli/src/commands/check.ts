/* eslint-disable unicorn/no-process-exit */
import { resolve, join } from "node:path";
import { stat, readdir } from "node:fs/promises";
import { defineCommand } from "citty";

import { runAstGrepScan } from "../actions/scan";
import { formatText } from "../actions/format";
import { printSchema } from "../actions/schema-output";
import {
  outputSchema as checkOutputSchema,
  errorSchema as checkErrorSchema,
} from "../schemas/check";

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
  async run({ args }) {
    // --schema short-circuits: print schemas and exit
    if (args.schema) {
      printSchema({
        output: checkOutputSchema,
        error: checkErrorSchema,
      });
      process.exit(0);
    }

    const cwd = resolve(args.dir ?? process.cwd());

    // Validate .taskless/taskless.json exists
    const tasklessJsonPath = join(cwd, ".taskless", "taskless.json");
    const tasklessJsonExists = await stat(tasklessJsonPath)
      .then((s) => s.isFile())
      .catch(() => false);

    if (!tasklessJsonExists) {
      const message =
        "Error: .taskless/taskless.json not found. Run `taskless init` to set up your project.";
      if (args.json) {
        console.log(
          JSON.stringify(
            checkErrorSchema.parse({
              success: false,
              error: message,
              results: [],
            })
          )
        );
      } else {
        console.error(message);
      }
      process.exit(1);
    }

    // Check for rule files
    const rulesDirectory = join(cwd, ".taskless", "rules");
    let ruleFiles: string[] = [];
    try {
      const entries = await readdir(rulesDirectory);
      ruleFiles = entries.filter((f) => f.endsWith(".yml"));
    } catch {
      // rules directory doesn't exist
    }

    if (ruleFiles.length === 0) {
      if (args.json) {
        console.log(
          JSON.stringify(
            checkOutputSchema.parse({ success: true, results: [] })
          )
        );
      } else {
        console.warn(
          "Warning: No rules found in .taskless/rules/. Nothing to check."
        );
        console.warn(`  directory: ${rulesDirectory}`);
        console.warn(
          "  If you expected rules here, check that your Taskless skills have generated .yml rule files."
        );
      }
      process.exit(0);
    }

    // Run scanner
    try {
      const { results } = await runAstGrepScan(cwd);
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
      process.exit(hasErrors ? 1 : 0);
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
      process.exit(1);
    }
  },
});
