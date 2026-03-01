import { defineCommand, runMain, showUsage } from "citty";

import { infoCommand } from "./commands/info";

const main = defineCommand({
  meta: {
    name: "taskless",
    version: __VERSION__,
    description: "Taskless CLI",
  },
  subCommands: {
    info: infoCommand,
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
