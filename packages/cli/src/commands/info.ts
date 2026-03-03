import { resolve } from "node:path";
import { defineCommand } from "citty";

import { checkStaleness } from "../actions/install";
import { getToken } from "../actions/token";

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
    const [tools, token] = await Promise.all([checkStaleness(cwd), getToken()]);
    console.log(
      JSON.stringify({
        version: __VERSION__,
        tools,
        loggedIn: token !== undefined,
      })
    );
  },
});
