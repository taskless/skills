/* eslint-disable unicorn/no-process-exit */
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { defineCommand } from "citty";

import { ZodError } from "zod";

import { getToken } from "../actions/token";
import {
  readProjectConfig,
  validateRulesConfig,
} from "../actions/project-config";
import { submitRule, pollRuleStatus, iterateRule } from "../actions/rule-api";
import {
  writeRuleFile,
  writeRuleTestFile,
  deleteRuleFiles,
} from "../actions/rule-files";
import { printSchema } from "../actions/schema-output";
import {
  inputSchema as createInputSchema,
  outputSchema as createOutputSchema,
  errorSchema as createErrorSchema,
} from "../schemas/rules-create";
import {
  inputSchema as improveInputSchema,
  outputSchema as improveOutputSchema,
  errorSchema as improveErrorSchema,
} from "../schemas/rules-improve";

/** Format today's date as YYYYMMDD */
function getTimestamp(): string {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

const POLL_INTERVAL_MS = 15_000;

const createCommand = defineCommand({
  meta: {
    name: "create",
    description:
      "Create a new rule from a JSON file (use --from to specify the input file)",
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
    from: {
      type: "string",
      description:
        "Path to a JSON file containing the rule request (required). Example: --from .taskless/.tmp-rule-request.json",
    },
  },
  async run({ args }) {
    // --schema short-circuits: print schemas and exit
    if (args.schema) {
      printSchema({
        input: createInputSchema,
        output: createOutputSchema,
        error: createErrorSchema,
      });
      process.exit(0);
    }

    const cwd = resolve(args.dir ?? process.cwd());

    /** Emit an error and exit, respecting --json mode */
    function fail(message: string): never {
      if (args.json) {
        console.log(
          JSON.stringify(createErrorSchema.parse({ error: message }))
        );
      } else {
        console.error(`Error: ${message}`);
      }
      process.exit(1);
    }

    // 1. Read and validate --from file
    if (!args.from) {
      fail(
        "--from is required. Provide a path to a JSON file.\n  Example: taskless rules create --from request.json"
      );
    }

    const filePath = resolve(cwd, args.from);
    let fileContent: string;
    try {
      fileContent = await readFile(filePath, "utf8");
    } catch {
      fail(`Could not read file "${args.from}".`);
    }

    let rawJson: unknown;
    try {
      rawJson = JSON.parse(fileContent) as unknown;
    } catch {
      fail(`"${args.from}" is not valid JSON.`);
    }

    let request: ReturnType<typeof createInputSchema.parse>;
    try {
      request = createInputSchema.parse(rawJson);
    } catch (error) {
      if (error instanceof ZodError) {
        fail(
          `Invalid input: ${error.issues.map((issue) => issue.message).join(", ")}`
        );
      }
      fail(error instanceof Error ? error.message : String(error));
    }

    // 2. Read project config and validate for rules
    let config;
    try {
      config = await readProjectConfig(cwd);
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    }

    const validation = validateRulesConfig(config);
    if (!validation.valid) {
      fail(validation.error);
    }

    // 3. Resolve auth token
    const token = await getToken();
    if (!token) {
      fail("Authentication required. Run `taskless auth login` first.");
    }

    // 4. Submit rule to API
    let ruleId: string;
    try {
      const response = await submitRule(token, {
        orgId: config.orgId!,
        repositoryUrl: config.repositoryUrl!,
        prompt: request.prompt,
        successCases: request.successCases,
        failureCases: request.failureCases,
      });
      ruleId = response.ruleId;
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    }

    // 5. Poll for results
    console.error(`Rule submitted (${ruleId}). Waiting for generation...`);

    while (true) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      let status;
      try {
        status = await pollRuleStatus(token, ruleId);
      } catch (error) {
        fail(
          `Polling failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      switch (status.status) {
        case "accepted": {
          console.error("Status: accepted — waiting for processing...");
          break;
        }
        case "building": {
          console.error("Status: building — generating rules...");
          break;
        }
        case "failed": {
          fail(`Rule generation failed: ${status.error}`);
          break;
        }
        case "generated": {
          // 6. Write files
          const timestamp = getTimestamp();
          const writtenFiles: string[] = [];
          const rules = status.rules ?? [];

          for (const rule of rules) {
            const ruleFile = await writeRuleFile(cwd, rule);
            writtenFiles.push(ruleFile);

            if (rule.tests) {
              const testFile = await writeRuleTestFile(cwd, rule, timestamp);
              writtenFiles.push(testFile);
            }
          }

          // 7. Output results
          if (args.json) {
            const output = createOutputSchema.parse({
              success: true,
              ruleId,
              rules: rules.map((r) => r.id),
              files: writtenFiles,
            });
            console.log(JSON.stringify(output));
          } else {
            console.log(`Generated ${String(rules.length)} rule(s):\n`);
            for (const filePath of writtenFiles) {
              console.log(`  ${filePath}`);
            }
          }
          return;
        }
        case "pr":
        case "merged":
        case "closed": {
          // Terminal states beyond generation — treat as done without files
          if (args.json) {
            const output = createOutputSchema.parse({
              success: true,
              ruleId,
              rules: [],
              files: [],
            });
            console.log(JSON.stringify(output));
          } else {
            console.log(`Rule ${ruleId} is in state "${status.status}".`);
          }
          return;
        }
      }
    }
  },
});

const improveCommand = defineCommand({
  meta: {
    name: "improve",
    description:
      "Improve an existing rule with guidance (use --from to specify the input file)",
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
    from: {
      type: "string",
      description:
        "Path to a JSON file containing { ruleId, guidance, references? }. Example: --from .taskless/.tmp-iterate-request.json",
    },
  },
  async run({ args }) {
    // --schema short-circuits: print schemas and exit
    if (args.schema) {
      printSchema({
        input: improveInputSchema,
        output: improveOutputSchema,
        error: improveErrorSchema,
      });
      process.exit(0);
    }

    const cwd = resolve(args.dir ?? process.cwd());

    /** Emit an error and exit, respecting --json mode */
    function fail(message: string): never {
      if (args.json) {
        console.log(
          JSON.stringify(improveErrorSchema.parse({ error: message }))
        );
      } else {
        console.error(`Error: ${message}`);
      }
      process.exit(1);
    }

    // 1. Read and validate --from file
    if (!args.from) {
      fail(
        "--from is required. Provide a path to a JSON file.\n  Example: taskless rules improve --from request.json"
      );
    }

    const filePath = resolve(cwd, args.from);
    let fileContent: string;
    try {
      fileContent = await readFile(filePath, "utf8");
    } catch {
      fail(`Could not read file "${args.from}".`);
    }

    let rawJson: unknown;
    try {
      rawJson = JSON.parse(fileContent) as unknown;
    } catch {
      fail(`"${args.from}" is not valid JSON.`);
    }

    let request: ReturnType<typeof improveInputSchema.parse>;
    try {
      request = improveInputSchema.parse(rawJson);
    } catch (error) {
      if (error instanceof ZodError) {
        fail(
          `Invalid input: ${error.issues.map((issue) => issue.message).join(", ")}`
        );
      }
      fail(error instanceof Error ? error.message : String(error));
    }

    // 2. Read project config and validate for rules
    let config;
    try {
      config = await readProjectConfig(cwd);
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    }

    const validation = validateRulesConfig(config);
    if (!validation.valid) {
      fail(validation.error);
    }

    // 3. Resolve auth token
    const token = await getToken();
    if (!token) {
      fail("Authentication required. Run `taskless auth login` first.");
    }

    // 4. Submit iterate request to API
    let requestId: string;
    try {
      const response = await iterateRule(token, request.ruleId, {
        orgId: config.orgId!,
        guidance: request.guidance,
        references: request.references,
      });
      requestId = response.requestId;
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    }

    // 5. Poll for results using the requestId
    console.error(
      `Iterate request submitted (${requestId}). Waiting for generation...`
    );

    while (true) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      let status;
      try {
        status = await pollRuleStatus(token, requestId);
      } catch (error) {
        fail(
          `Polling failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      switch (status.status) {
        case "accepted": {
          console.error("Status: accepted — waiting for processing...");
          break;
        }
        case "building": {
          console.error("Status: building — generating rules...");
          break;
        }
        case "failed": {
          fail(`Rule iteration failed: ${status.error}`);
          break;
        }
        case "generated": {
          // 6. Write files (overwrites existing rule files)
          const timestamp = getTimestamp();
          const writtenFiles: string[] = [];
          const rules = status.rules ?? [];

          for (const rule of rules) {
            const ruleFile = await writeRuleFile(cwd, rule);
            writtenFiles.push(ruleFile);

            if (rule.tests) {
              const testFile = await writeRuleTestFile(cwd, rule, timestamp);
              writtenFiles.push(testFile);
            }
          }

          // 7. Output results
          if (args.json) {
            const output = improveOutputSchema.parse({
              success: true,
              requestId,
              rules: rules.map((r) => r.id),
              files: writtenFiles,
            });
            console.log(JSON.stringify(output));
          } else {
            console.log(`Updated ${String(rules.length)} rule(s):\n`);
            for (const filePath of writtenFiles) {
              console.log(`  ${filePath}`);
            }
          }
          return;
        }
        case "pr":
        case "merged":
        case "closed": {
          if (args.json) {
            const output = improveOutputSchema.parse({
              success: true,
              requestId,
              rules: [],
              files: [],
            });
            console.log(JSON.stringify(output));
          } else {
            console.log(`Request ${requestId} is in state "${status.status}".`);
          }
          return;
        }
      }
    }
  },
});

const deleteCommand = defineCommand({
  meta: {
    name: "delete",
    description: "Delete a rule and its test files",
  },
  args: {
    dir: {
      type: "string",
      alias: "d",
      description: "Working directory",
    },
    id: {
      type: "positional",
      description: "Rule ID to delete",
      required: true,
    },
  },
  async run({ args }) {
    const cwd = resolve(args.dir ?? process.cwd());
    const id = args.id;

    const deleted = await deleteRuleFiles(cwd, id);
    if (deleted) {
      console.log(`Deleted rule "${id}" and associated test files.`);
    } else {
      console.error(
        `Error: Rule "${id}" not found in .taskless/rules/${id}.yml`
      );
      process.exit(1);
    }
  },
});

export const rulesCommand = defineCommand({
  meta: {
    name: "rules",
    description: "Manage Taskless rules",
  },
  subCommands: {
    create: createCommand,
    improve: improveCommand,
    delete: deleteCommand,
  },
});
