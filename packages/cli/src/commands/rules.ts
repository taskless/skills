/* eslint-disable unicorn/no-process-exit */
import { resolve } from "node:path";
import { defineCommand } from "citty";

import { getToken } from "../actions/token";
import {
  readProjectConfig,
  validateRulesConfig,
} from "../actions/project-config";
import { ruleApiProvider, type RuleCreateRequest } from "../actions/rule-api";
import {
  writeRuleFile,
  writeRuleTestFile,
  deleteRuleFiles,
} from "../actions/rule-files";

/** Read all of stdin as a string */
async function readStdin(): Promise<string> {
  // If stdin is a TTY, there's no piped data
  if (process.stdin.isTTY) {
    return "";
  }

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

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
    description: "Create a new rule from a description (reads JSON from stdin)",
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

    // 1. Read and validate stdin
    const input = await readStdin();
    if (!input.trim()) {
      console.error(
        'Error: A JSON payload is required on stdin. Example:\n  echo \'{"prompt": "detect console.log usage"}\' | taskless rules create'
      );
      process.exit(1);
    }

    let request: RuleCreateRequest;
    try {
      request = JSON.parse(input) as RuleCreateRequest;
    } catch {
      console.error("Error: stdin is not valid JSON.");
      process.exit(1);
    }

    if (typeof request.prompt !== "string" || !request.prompt.trim()) {
      console.error(
        'Error: Missing required field "prompt" in the JSON payload.'
      );
      process.exit(1);
    }

    // 2. Read project config and validate for rules
    let config;
    try {
      config = await readProjectConfig(cwd);
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }

    const validation = validateRulesConfig(config);
    if (!validation.valid) {
      console.error(`Error: ${validation.error}`);
      process.exit(1);
    }

    // 3. Resolve auth token
    const token = await getToken();
    if (!token) {
      console.error(
        "Error: Authentication required. Run `taskless auth login` first."
      );
      process.exit(1);
    }

    // 4. Submit rule to API
    let ruleId: string;
    try {
      const response = await ruleApiProvider.submitRule(token, {
        orgId: config.orgId!,
        repositoryUrl: config.repositoryUrl!,
        prompt: request.prompt,
        language: request.language,
        successCase: request.successCase,
        failureCase: request.failureCase,
      });
      ruleId = response.ruleId;
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }

    // 5. Poll for results
    console.error(`Rule submitted (${ruleId}). Waiting for generation...`);

    while (true) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      let status;
      try {
        status = await ruleApiProvider.pollRuleStatus(token, ruleId);
      } catch (error) {
        console.error(
          `Error: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
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
          console.error(`Error: Rule generation failed: ${status.error}`);
          process.exit(1);
          break;
        }
        case "generated": {
          // 6. Write files
          const timestamp = getTimestamp();
          const writtenFiles: string[] = [];

          for (const rule of status.rules) {
            const ruleFile = await writeRuleFile(cwd, rule);
            writtenFiles.push(ruleFile);

            if (rule.tests) {
              const testFile = await writeRuleTestFile(cwd, rule, timestamp);
              writtenFiles.push(testFile);
            }
          }

          // 7. Output results
          if (args.json) {
            console.log(
              JSON.stringify({
                ruleId,
                rules: status.rules.map((r) => r.id),
                files: writtenFiles,
              })
            );
          } else {
            console.log(`Generated ${String(status.rules.length)} rule(s):\n`);
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
          console.log(`Rule ${ruleId} is in state "${status.status}".`);
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
    delete: deleteCommand,
  },
});
