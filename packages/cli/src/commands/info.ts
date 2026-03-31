/* eslint-disable unicorn/no-process-exit */
import { resolve } from "node:path";
import { defineCommand } from "citty";

import { checkStaleness } from "../install/install";
import { getToken } from "../auth/token";
import { fetchWhoami } from "../auth/whoami";
import { printSchema } from "../util/schema-output";
import {
  outputSchema as infoOutputSchema,
  errorSchema as infoErrorSchema,
} from "../schemas/info";

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
    json: {
      type: "boolean",
      description: "Output as JSON",
      default: false,
    },
    schema: {
      type: "boolean",
      description: "Print output/error JSON Schemas and exit",
      default: false,
    },
  },
  async run({ args }) {
    if (args.schema) {
      printSchema({
        output: infoOutputSchema,
        error: infoErrorSchema,
      });
      process.exit(0);
    }

    const cwd = resolve(args.dir ?? process.cwd());
    const [tools, token] = await Promise.all([
      checkStaleness(cwd),
      getToken(cwd),
    ]);

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

    const result = {
      success: true as const,
      version: __VERSION__,
      tools,
      loggedIn: token !== undefined,
      auth,
    };

    if (args.json) {
      console.log(JSON.stringify(infoOutputSchema.parse(result)));
      return;
    }

    // Human-readable output
    console.log(`Taskless CLI v${__VERSION__}\n`);

    if (tools.length === 0) {
      console.log("Tools: none detected");
    } else {
      console.log("Tools:");
      for (const tool of tools) {
        const total = tool.skills.length;
        const upToDate = tool.skills.filter((s) => s.current).length;
        const stale = total - upToDate;

        if (stale === 0) {
          console.log(
            `  ${tool.name}: ${String(total)} skills (all up to date)`
          );
        } else {
          console.log(
            `  ${tool.name}: ${String(total)} skills (${String(stale)} outdated)`
          );
          for (const skill of tool.skills) {
            if (!skill.current) {
              console.log(
                `    - ${skill.name}: ${skill.installedVersion ?? "missing"} → ${skill.currentVersion}`
              );
            }
          }
        }
      }
    }

    console.log("");
    if (auth) {
      const orgs = auth.orgs.length > 0 ? ` (${auth.orgs.join(", ")})` : "";
      console.log(`Auth: logged in as ${auth.user}${orgs}`);
    } else {
      console.log("Auth: not logged in");
    }
  },
});
