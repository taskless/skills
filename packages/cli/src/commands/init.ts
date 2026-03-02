import { resolve } from "node:path";
import { defineCommand } from "citty";

import {
  detectTools,
  getEmbeddedSkills,
  installForTool,
  writeAgentsMd,
} from "../actions/install";

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description: "Install or update Taskless skills",
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
    const skills = getEmbeddedSkills();
    const tools = await detectTools(cwd);

    if (tools.length === 0) {
      await writeAgentsMd(cwd, __VERSION__);
      console.log(
        `No tool directories detected. Wrote AGENTS.md with Taskless CLI reference.`
      );
      return;
    }

    for (const tool of tools) {
      const installed = await installForTool(cwd, tool, skills);
      console.log(`${tool.name}: installed ${installed.length} skill(s)`);
      for (const name of installed) {
        console.log(`  - ${name}`);
      }
      if (tool.commands) {
        console.log(
          `  + ${installed.length} derived command(s) in ${tool.dir}/${tool.commands.path}/`
        );
      }
    }
  },
});
