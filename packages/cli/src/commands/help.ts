import { resolve } from "node:path";

import {
  defineCommand,
  type CommandDef,
  type Resolvable,
  type SubCommandsDef,
} from "citty";
import { sprintf } from "sprintf-js";
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

// Help-only recipe topics (no backing subcommand) that should still be
// discoverable from the `taskless help` index. The rule-authoring front
// door (`route`) and its destinations live here so an agent can find them.
const RECIPE_TOPICS: ReadonlyArray<[string, string]> = [
  ["route", "Decide where to author a rule (existing/static/remote)"],
  ["existing", "Author a rule in a linter the repo already uses"],
  ["static", "Author a local ast-grep rule on this machine (no login)"],
  ["remote", "Generate a rule via the Taskless service (login)"],
];

// Topic → Zod input schema. When a recipe contains the %(INPUT_SCHEMA)s
// placeholder, the help command substitutes the JSON Schema rendered
// from this Zod source.
const TOPIC_INPUT_SCHEMAS: Record<string, z.ZodType> = {
  "rule-create": ruleCreateInputSchema,
  "rule-improve": ruleImproveInputSchema,
};

/**
 * Render a recipe by interpolating sprintf-js named arguments. The recipe
 * source uses `%(KEY)s` placeholders; the variable table built here resolves
 * each known placeholder to its rendered string. Recipes that contain a
 * literal `%` character must escape it as `%%` per sprintf-js conventions.
 *
 * Two flavors of substitution coexist in the variables table:
 * - System-resolved values (e.g. `CLI_VERSION`) — rendered to a real value.
 * - Agent-fill markers (e.g. `PACKAGE_MANAGER_DLX`) — rendered as
 *   `<lower-kebab-name>` so the consuming agent knows to substitute.
 */
function renderRecipe(content: string, topic: string): string {
  const variables: Record<string, string> = {
    CLI_VERSION: __VERSION__,
    PACKAGE_MANAGER_DLX: "<package-manager-dlx>",
  };
  if (content.includes("%(INPUT_SCHEMA)s")) {
    const schema = TOPIC_INPUT_SCHEMAS[topic];
    variables.INPUT_SCHEMA = schema
      ? JSON.stringify(z.toJSONSchema(schema), null, 2)
      : "(no input schema for this topic)";
  }
  return sprintf(content, variables);
}

/**
 * Look up a help topic from the embedded recipe map and return the rendered
 * text. Anonymous variants are preferred when `anonymous` is set and a
 * variant exists; otherwise the canonical recipe is returned. Returns
 * `undefined` when the topic is unknown.
 */
export function getRecipe(
  topic: string,
  options: { anonymous?: boolean } = {}
): string | undefined {
  const content = options.anonymous
    ? (anonymousMap.get(topic) ?? helpMap.get(topic))
    : helpMap.get(topic);
  if (content === undefined) return undefined;
  return renderRecipe(content, topic);
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

        // Pad commands and recipe topics against a shared width so the two
        // sections line up.
        const maxLength = Math.max(
          ...entries.map(([name]) => name.length),
          ...RECIPE_TOPICS.map(([name]) => name.length)
        );
        for (const [name, description] of entries) {
          console.log(`  ${name.padEnd(maxLength + 2)}${description}`);
        }

        console.log("\nAuthoring recipes:");
        for (const [name, description] of RECIPE_TOPICS) {
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
