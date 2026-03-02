import { resolve } from "node:path";
import { defineCommand } from "citty";

import { checkStaleness } from "../actions/install";

export const infoCommand = defineCommand({
  meta: {
    name: "info",
    description: "Show Taskless CLI information",
  },
  args: {
    dir: {
      type: "string",
      alias: "d",
      description: "Working directory",
    },
  },
  async run({ args }) {
    const cwd = resolve(args.dir ?? process.cwd());
    const tools = await checkStaleness(cwd);
    console.log(JSON.stringify({ version: __VERSION__, tools }));
  },
});
