import { resolve } from "node:path";

import {
  defineCommand,
  type CommandDef,
  type Resolvable,
  type SubCommandsDef,
} from "citty";

import { getTelemetry } from "../telemetry";

// Help text files embedded at build time via Vite import.meta.glob
const helpFiles: Record<string, string> = import.meta.glob("../help/*.txt", {
  query: "?raw",
  import: "default",
  eager: true,
});

// Build a lookup map: "check" → content, "auth-login" → content, etc.
function buildHelpMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [path, content] of Object.entries(helpFiles)) {
    const filename = path
      .split("/")
      .pop()
      ?.replace(/\.txt$/, "");
    if (filename) {
      map.set(filename, content);
    }
  }
  return map;
}

const helpMap = buildHelpMap();

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
    },
    async run({ args, rawArgs }) {
      // Extract positional args from rawArgs, skipping flags and their values.
      // --dir/-d take a value; --json is boolean and does not.
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
        console.log("Commands:");

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
          "\nRun `taskless help <command>` for details on a specific command."
        );
        return;
      }

      // Join positional args to form the lookup key
      const key = positionals.join("-");
      const content = helpMap.get(key);

      if (content) {
        // help_<topic>: agent fetched a specific recipe (intent signal)
        const topicEvent = `help_${key.replaceAll("-", "_")}`;
        telemetry.capture(topicEvent, { topic: positionals.join(" ") });
        console.log(content.trimEnd());
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
