import { resolve } from "node:path";

import {
  defineCommand,
  type CommandDef,
  type Resolvable,
  type SubCommandsDef,
} from "citty";
import { z } from "zod";

import { getTelemetry } from "../telemetry";
import { inputSchema as ruleCreateInputSchema } from "../schemas/rules-create";
import { inputSchema as ruleImproveInputSchema } from "../schemas/rules-improve";

// Help text files embedded at build time via Vite import.meta.glob.
// Filename convention: <topic>.txt for the canonical recipe and
// <topic>.anonymous.txt for the local-only variant (when the flow
// genuinely differs).
const helpFiles: Record<string, string> = import.meta.glob("../help/*.txt", {
  query: "?raw",
  import: "default",
  eager: true,
});

// Build two lookup maps:
//   - helpMap: "rule-create"           → canonical recipe text
//   - anonymousMap: "rule-create"      → anonymous variant text (if exists)
function buildHelpMaps(): {
  helpMap: Map<string, string>;
  anonymousMap: Map<string, string>;
} {
  const helpMap = new Map<string, string>();
  const anonymousMap = new Map<string, string>();
  for (const [path, content] of Object.entries(helpFiles)) {
    const filename = path
      .split("/")
      .pop()
      ?.replace(/\.txt$/, "");
    if (!filename) continue;
    if (filename.endsWith(".anonymous")) {
      const topic = filename.slice(0, -".anonymous".length);
      anonymousMap.set(topic, content);
    } else {
      helpMap.set(filename, content);
    }
  }
  return { helpMap, anonymousMap };
}

const { helpMap, anonymousMap } = buildHelpMaps();

// Topic → Zod input schema. When a recipe contains the {{INPUT_SCHEMA}}
// placeholder, the help command substitutes the JSON Schema rendered
// from this Zod source.
const TOPIC_INPUT_SCHEMAS: Record<string, z.ZodType> = {
  "rule-create": ruleCreateInputSchema,
  "rule-improve": ruleImproveInputSchema,
};

function renderRecipe(content: string, topic: string): string {
  let out = content;
  out = out.replaceAll("{{CLI_VERSION}}", __VERSION__);
  if (out.includes("{{INPUT_SCHEMA}}")) {
    const schema = TOPIC_INPUT_SCHEMAS[topic];
    const rendered = schema
      ? JSON.stringify(z.toJSONSchema(schema), null, 2)
      : "(no input schema for this topic)";
    out = out.replaceAll("{{INPUT_SCHEMA}}", rendered);
  }
  return out;
}

async function unwrap<T>(resolvable: Resolvable<T>): Promise<T> {
  if (typeof resolvable === "function") {
    return (resolvable as () => T | Promise<T>)();
  }
  return resolvable;
}

async function resolveDescription(
  cmd: Resolvable<CommandDef>
): Promise<string> {
  const resolved = await unwrap(cmd);
  const meta = resolved.meta ? await unwrap(resolved.meta) : undefined;
  return meta?.description ?? "";
}

export function createHelpCommand(subCommands: SubCommandsDef) {
  return defineCommand({
    meta: {
      name: "help",
      description: "Show help for a command",
    },
    args: {
      dir: {
        type: "string",
        alias: "d",
        description: "Working directory",
        default: process.cwd(),
      },
      anonymous: {
        type: "boolean",
        description:
          "Return the local-only recipe variant when the topic has one",
        default: false,
      },
    },
    async run({ args, rawArgs }) {
      // Extract positional args from rawArgs, skipping flags and their values.
      // --dir/-d take a value; --json/--anonymous are boolean and do not.
      const valueFlagSet = new Set(["--dir", "-d"]);
      const positionals: string[] = [];
      for (let index = 0; index < rawArgs.length; index++) {
        const argument = rawArgs[index]!;
        if (argument.startsWith("-")) {
          if (!argument.includes("=") && valueFlagSet.has(argument)) index++;
          continue;
        }
        if (argument !== "help") positionals.push(argument);
      }

      const cwd = resolve(args.dir);
      const telemetry = await getTelemetry(cwd);

      if (positionals.length === 0) {
        // help_index: agent fetched the topic list
        telemetry.capture("help_index");

        console.log("Taskless CLI\n");
        console.log(
          "For agents: this command returns recipes for an AI coding agent to follow."
        );
        console.log(
          "For humans: run `npx @taskless/cli` (no args) to install or update Taskless,"
        );
        console.log("then ask your coding agent to do the work.\n");
        console.log("Topics:");

        const entries: Array<[string, string]> = [];
        for (const [name, cmd] of Object.entries(subCommands)) {
          if (name === "help") continue;
          const description = await resolveDescription(cmd);
          entries.push([name, description]);
        }

        const maxLength = Math.max(...entries.map(([name]) => name.length));
        for (const [name, description] of entries) {
          console.log(`  ${name.padEnd(maxLength + 2)}${description}`);
        }

        console.log(
          "\nAppend `--anonymous` to any rule/check command to skip the Taskless API"
        );
        console.log("and use local-only behavior.");
        console.log(
          "\nRun `taskless help <topic>` for the full recipe (e.g. `taskless help rule create`)."
        );
        return;
      }

      // Join positional args to form the lookup key
      const key = positionals.join("-");

      // Anonymous variant lookup: prefer <topic>.anonymous.txt when
      // --anonymous is set, fall back to the canonical recipe.
      const content = args.anonymous
        ? (anonymousMap.get(key) ?? helpMap.get(key))
        : helpMap.get(key);

      if (content) {
        // help_<topic>: agent fetched a specific recipe (intent signal)
        const topicEvent = `help_${key.replaceAll("-", "_")}`;
        telemetry.capture(topicEvent, {
          topic: positionals.join(" "),
          anonymous: args.anonymous,
        });
        console.log(renderRecipe(content, key).trimEnd());
      } else {
        // help_unknown: agent asked for a topic that does not exist
        telemetry.capture("help_unknown", { topic: positionals.join(" ") });
        console.error(`Unknown command: ${positionals.join(" ")}`);
        console.error("Run `taskless help` for available commands.");
        process.exitCode = 1;
      }
    },
  });
}
