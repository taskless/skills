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

export function createHelpCommand(
  subCommands: SubCommandsDef
): CommandDef<Record<string, never>> {
  return defineCommand({
    meta: {
      name: "help",
      description: "Show help for a command",
    },
    async run({ rawArgs }) {
      // Filter out flags from rawArgs, keep only positional args
      // Also filter out "help" itself if citty passes it
      const positionals = rawArgs.filter(
        (argument) => !argument.startsWith("-") && argument !== "help"
      );

      const telemetry = await getTelemetry(process.cwd());
      if (positionals.length === 0) {
        telemetry.capture("cli_help");
      } else {
        const commandEvents: Record<string, string> = {
          auth: "cli_help_auth",
          check: "cli_help_check",
          info: "cli_help_info",
          init: "cli_help_init",
          rules: "cli_help_rule",
        };
        const first = positionals[0] as string;
        const event = commandEvents[first] ?? "cli_help";
        telemetry.capture(event, { topic: positionals.join(" ") });
      }

      if (positionals.length === 0) {
        // No args: show command index
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
        console.log(content.trimEnd());
      } else {
        console.error(`Unknown command: ${positionals.join(" ")}`);
        console.error("Run `taskless help` for available commands.");
        process.exitCode = 1;
      }
    },
  });
}
