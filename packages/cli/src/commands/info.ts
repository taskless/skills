import { resolve } from "node:path";
import { defineCommand } from "citty";

import { checkStaleness } from "../install/install";
import { getToken } from "../auth/token";
import { fetchWhoami } from "../auth/whoami";

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

    let auth: { user: string; email: string; orgs: string[] } | undefined;
    if (token) {
      const whoami = await fetchWhoami(token);
      if (whoami) {
        auth = {
          user: whoami.user,
          email: whoami.email,
          orgs: whoami.orgs.map((o) => o.name),
        };
      }
    }

    console.log(
      JSON.stringify({
        success: true,
        version: __VERSION__,
        tools,
        loggedIn: token !== undefined,
        auth,
      })
    );
  },
});
