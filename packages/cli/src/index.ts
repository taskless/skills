import { defineCommand, runCommand, showUsage } from "citty";

import { authCommand } from "./commands/auth";
import { checkCommand } from "./commands/check";
import { initCommand } from "./commands/init";
import { infoCommand } from "./commands/info";
import { createHelpCommand } from "./commands/help";
import { rulesCommand } from "./commands/rules";
import { getTelemetry } from "./telemetry";

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
    // Only show help when no positional args (i.e. no subcommand) were provided.
    if (!rawArgs.some((argument) => !argument.startsWith("-"))) {
      await showUsage(cmd);
    }
  },
});

// main loop to run cli and make every attempt to shut down gracefully
try {
  await runCommand(main, { rawArgs: process.argv.slice(2) });
} catch (error) {
  process.exitCode = 1;
  console.error(error instanceof Error ? error.message : String(error));
} finally {
  try {
    const t = await getTelemetry();
    await t.shutdown();
  } catch {
    //
  }
}
