/* eslint-disable unicorn/no-process-exit */
import { resolve, join } from "node:path";
import { readdir } from "node:fs/promises";
import { defineCommand } from "citty";

import { runAstGrepScan } from "../rules/scan";
import { formatText } from "../util/format";
import { generateSgConfig } from "../rules/sgconfig";
import { printSchema } from "../util/schema-output";
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
      process.exit(0);
    }

    // Generate ephemeral sgconfig.yml and run scanner
    try {
      await generateSgConfig(cwd);
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
