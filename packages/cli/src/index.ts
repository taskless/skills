import { defineCommand, runCommand, showUsage } from "citty";

import { authCommand } from "./commands/auth";
import { checkCommand } from "./commands/check";
import { initCommand, updateCommand } from "./commands/init";
import { infoCommand } from "./commands/info";
import { createHelpCommand } from "./commands/help";
import { onboardCommand } from "./commands/onboard";
import { ruleCommand } from "./commands/rules";
import { shutdownTelemetry } from "./telemetry";
import { CliError } from "./util/cli-error";

const subCommands = {
  init: initCommand,
  update: updateCommand,
  info: infoCommand,
  check: checkCommand,
  auth: authCommand,
  onboard: onboardCommand,
  rule: ruleCommand,
};

const helpCommand = createHelpCommand(subCommands);

const main = defineCommand({
  meta: {
    name: "taskless",
    version: __VERSION__,
    description: "Taskless CLI",
  },
  args: {
    dir: {
      type: "string",
      alias: "d",
      description: "Set the working directory",
    },
    json: {
      type: "boolean",
      description: "Output as JSON",
      default: false,
    },
  },
  subCommands: {
    ...subCommands,
    help: helpCommand,
  },
  async run({ rawArgs, cmd }) {
    // citty always calls the parent's run handler, even after a subcommand.
    // Only take action when no positional args (i.e. no subcommand) were
    // provided. A value following `-d`/`--dir` is a flag value, not a
    // positional, so skip it when scanning.
    const hasPositional = rawArgs.some((argument, index) => {
      if (argument.startsWith("-")) return false;
      const previous = rawArgs[index - 1];
      if (previous === "-d" || previous === "--dir") return false;
      return true;
    });
    if (hasPositional) {
      return;
    }

    // Only delegate to `init` when the only flags present are ones init
    // also understands (`-d` / `--dir`). Help/version/json flags and
    // any unknown flags should fall through to citty's default help instead
    // of silently launching the wizard.
    const onlyInitFlags = rawArgs.every((argument, index) => {
      if (!argument.startsWith("-")) {
        const previous = rawArgs[index - 1];
        return previous === "-d" || previous === "--dir";
      }
      if (argument === "-d" || argument === "--dir") return true;
      return false;
    });
    if (!onlyInitFlags) {
      await showUsage(cmd);
      return;
    }

    // TTY → run the interactive wizard. Non-TTY → print a short preamble
    // explaining the context and then delegate to `help` so agents and
    // pipes see the topic index.
    if (process.stdout.isTTY === true && process.stdin.isTTY === true) {
      await runCommand(initCommand, { rawArgs });
      return;
    }

    console.error(
      "Taskless CLI — non-interactive context detected.\n" +
        "  For interactive install, run from a terminal.\n" +
        "  For scripted install, run `taskless init --no-interactive`.\n" +
        "  For agent recipes, run `taskless help` (no args) for the topic index.\n"
    );
    // Forward the parent's rawArgs (e.g. `-d <path>`) so the help command
    // doesn't mis-parse them as positional topic names.
    await runCommand(helpCommand, { rawArgs: ["help", ...rawArgs] });
  },
});

// main loop to run cli and make every attempt to shut down gracefully
try {
  await runCommand(main, { rawArgs: process.argv.slice(2) });
} catch (error) {
  // CliError = expected failure (already printed output, exitCode already set)
  if (!(error instanceof CliError)) {
    process.exitCode = 1;
    console.error(error instanceof Error ? error.message : String(error));
  }
} finally {
  try {
    await shutdownTelemetry();
  } catch {
    //
  }
}
