import { defineCommand, runCommand, showUsage } from "citty";

import { authCommand } from "./commands/auth";
import { checkCommand } from "./commands/check";
import { initCommand } from "./commands/init";
import { infoCommand } from "./commands/info";
import { createHelpCommand } from "./commands/help";
import { rulesCommand } from "./commands/rules";
import { shutdownTelemetry } from "./telemetry";
import { CliError } from "./util/cli-error";

const subCommands = {
  init: initCommand,
  info: infoCommand,
  check: checkCommand,
  auth: authCommand,
  rules: rulesCommand,
};

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
    schema: {
      type: "boolean",
      description: "Print input/output/error JSON Schemas and exit",
      default: false,
    },
  },
  subCommands: {
    ...subCommands,
    help: createHelpCommand(subCommands),
  },
  async run({ rawArgs, cmd }) {
    // citty always calls the parent's run handler, even after a subcommand.
    // Only take action when no positional args (i.e. no subcommand) were provided.
    if (rawArgs.some((argument) => !argument.startsWith("-"))) {
      return;
    }

    // TTY → run the interactive wizard. Non-TTY → show help as before so
    // scripted invocations that pipe `taskless` keep working.
    if (process.stdout.isTTY === true) {
      await runCommand(initCommand, {
        rawArgs: rawArgs.filter((argument) => argument.startsWith("-")),
      });
      return;
    }

    await showUsage(cmd);
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
