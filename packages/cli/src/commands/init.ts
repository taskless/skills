import { resolve } from "node:path";
import { defineCommand } from "citty";

import {
  detectTools,
  getEmbeddedSkills,
  getEmbeddedCommands,
  installForTool,
} from "../install/install";
import { getTelemetry } from "../telemetry";

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
    const telemetry = await getTelemetry(cwd);
    telemetry.capture("cli_init");

    const skills = getEmbeddedSkills();
    const commands = getEmbeddedCommands();
    const tools = await detectTools(cwd);

    if (tools.length === 0) {
      console.log(
        `No supported tool directories detected.\n\nAlternative installation methods:\n  - Claude Code Plugin Marketplace: /plugin marketplace add taskless/skills\n  - Vercel Skills CLI: npx skills add taskless/skills`
      );
      return;
    }

    for (const tool of tools) {
      const result = await installForTool(cwd, tool, skills, commands);
      console.log(
        `${tool.name}: installed ${String(result.skills.length)} skill(s)`
      );
      for (const name of result.skills) {
        console.log(`  - ${name}`);
      }
      if (result.commands.length > 0) {
        console.log(
          `  + ${String(result.commands.length)} command(s) in ${tool.dir}/${tool.commands!.path}/`
        );
      }
    }
  },
});
