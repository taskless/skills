import { resolve } from "node:path";
import { defineCommand } from "citty";

import {
  AGENTS_FALLBACK,
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

    let installCount = 0;

    for (const tool of tools) {
      const result = await installForTool(cwd, tool, skills, commands);
      installCount++;
      console.log(
        `${tool.name}: installed ${String(result.skills.length)} skill(s)`
      );
      for (const name of result.skills) {
        console.log(`  - ${name}`);
      }
      if (result.commands.length > 0) {
        console.log(
          `  + ${String(result.commands.length)} command(s) in ${tool.installDir}/${tool.commands!.path}/`
        );
      }
    }

    if (installCount === 0) {
      const result = await installForTool(cwd, AGENTS_FALLBACK, skills, []);
      console.log(
        `No tools detected. Using fallback: ${AGENTS_FALLBACK.installDir}/`
      );
      console.log(
        `${AGENTS_FALLBACK.name}: installed ${String(result.skills.length)} skill(s)`
      );
      for (const name of result.skills) {
        console.log(`  - ${name}`);
      }
    }
  },
});
