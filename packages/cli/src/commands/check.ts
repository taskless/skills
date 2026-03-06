/* eslint-disable unicorn/no-process-exit */
import { resolve, join } from "node:path";
import { stat, readdir, readFile } from "node:fs/promises";
import { defineCommand } from "citty";

import { runAstGrepScan } from "../actions/scan";
import { formatText, formatJson } from "../actions/format";
import {
  isValidSpecVersion,
  isSupportedSpecVersion,
  COMPATIBILITY,
} from "../capabilities";

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
  },
  async run({ args }) {
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
        console.log(formatJson([], { success: false, error: message }));
      } else {
        console.error(message);
      }
      process.exit(1);
    }

    // Read and validate spec version
    let projectVersion: string;
    try {
      const raw = await readFile(tasklessJsonPath, "utf8");
      const config = JSON.parse(raw) as { version?: string };
      if (!config.version) {
        const message =
          'Error: .taskless/taskless.json is missing the "version" field.';
        if (args.json) {
          console.log(formatJson([], { success: false, error: message }));
        } else {
          console.error(message);
        }
        process.exit(1);
      }
      if (!isValidSpecVersion(config.version)) {
        const message = `Error: Invalid spec version "${config.version}" in .taskless/taskless.json. Expected YYYY-MM-DD format.`;
        if (args.json) {
          console.log(formatJson([], { success: false, error: message }));
        } else {
          console.error(message);
        }
        process.exit(1);
      }
      projectVersion = config.version;
    } catch (error) {
      if (error instanceof SyntaxError) {
        const message = "Error: .taskless/taskless.json is not valid JSON.";
        if (args.json) {
          console.log(formatJson([], { success: false, error: message }));
        } else {
          console.error(message);
        }
        process.exit(1);
      }
      throw error;
    }

    // Strict version check
    if (!isSupportedSpecVersion(projectVersion)) {
      const ranges = COMPATIBILITY.map((r) =>
        r.end === undefined ? `${r.start}+` : `${r.start} to ${r.end}`
      ).join(", ");
      const message = `Error: Spec version ${projectVersion} is not supported by this CLI (supports ${ranges}). Please use a compatible version of @taskless/cli.`;
      if (args.json) {
        console.log(formatJson([], { success: false, error: message }));
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
        console.log(formatJson([], { success: true }));
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

      // Format output
      const output = args.json ? formatJson(results) : formatText(results);
      console.log(output);

      // Exit code: 1 if any errors, 0 otherwise
      const hasErrors = results.some((r) => r.severity === "error");
      process.exit(hasErrors ? 1 : 0);
    } catch (error) {
      const message = `Error: ${error instanceof Error ? error.message : String(error)}`;
      if (args.json) {
        console.log(formatJson([], { success: false, error: message }));
      } else {
        console.error(message);
      }
      process.exit(1);
    }
  },
});
