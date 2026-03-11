import { defineCommand, runMain, showUsage } from "citty";

import { authCommand } from "./commands/auth";
import { checkCommand } from "./commands/check";
import { initCommand } from "./commands/init";
import { infoCommand } from "./commands/info";
import { createHelpCommand } from "./commands/help";
import { rulesCommand } from "./commands/rules";
import { updateEngineCommand } from "./commands/update-engine";

const subCommands = {
  init: initCommand,
  info: infoCommand,
  check: checkCommand,
  auth: authCommand,
  rules: rulesCommand,
  "update-engine": updateEngineCommand,
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

void runMain(main);
