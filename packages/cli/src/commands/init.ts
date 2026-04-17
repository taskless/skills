import { resolve } from "node:path";
import { defineCommand } from "citty";

import { ensureTasklessDirectory } from "../filesystem/directory";
import {
  AGENTS_FALLBACK,
  applyInstallPlan,
  detectTools,
  getEmbeddedSkills,
  getEmbeddedCommands,
  type InstallPlanTarget,
} from "../install/install";
import { getMandatorySkillNames } from "../install/catalog";
import { getTelemetry } from "../telemetry";
import { runWizard } from "../wizard";
import { getCliVersion } from "../wizard/intro";

function shouldRunInteractively(noInteractiveFlag: boolean): boolean {
  if (noInteractiveFlag) return false;
  if (process.env.CI === "true" || process.env.CI === "1") return false;
  // Require both stdin and stdout to be TTYs — clack reads from stdin, so a
  // piped stdin (common in scripts) would hang the wizard even when stdout
  // is a TTY.
  return process.stdout.isTTY === true && process.stdin.isTTY === true;
}

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
    "no-interactive": {
      type: "boolean",
      description:
        "Install every mandatory skill to every detected tool without prompting",
      default: false,
    },
  },
  async run({ args }) {
    const cwd = resolve(args.dir ?? process.cwd());
    const telemetry = await getTelemetry(cwd);
    telemetry.capture("cli_init");

    const interactive = shouldRunInteractively(args["no-interactive"]);

    if (interactive) {
      const result = await runWizard({ cwd });
      if (result.status === "cancelled") {
        process.exitCode = 1;
      }
      return;
    }

    if (!args["no-interactive"] && process.stdout.isTTY !== true) {
      console.error(
        "Detected non-interactive context (no TTY); running non-interactive install."
      );
    }

    const start = Date.now();
    await runNonInteractive(cwd);
    telemetry.capture("cli_init_completed", {
      locations: await detectedLocationDirectories(cwd),
      optionalSkills: [],
      authPromptShown: false,
      authCompleted: false,
      nonInteractive: true,
      durationMs: Date.now() - start,
    });
  },
});

async function runNonInteractive(cwd: string): Promise<void> {
  await ensureTasklessDirectory(cwd);

  const allSkills = getEmbeddedSkills();
  const mandatoryNames = new Set(getMandatorySkillNames());
  const skills = allSkills.filter((s) => mandatoryNames.has(s.name));
  const commands = getEmbeddedCommands();
  const tools = await detectTools(cwd);

  const planTargets: InstallPlanTarget[] = [];
  let usingFallback = false;

  if (tools.length > 0) {
    for (const tool of tools) {
      planTargets.push({
        tool,
        skills,
        commands: tool.commands ? commands : [],
      });
    }
  } else {
    usingFallback = true;
    planTargets.push({
      tool: AGENTS_FALLBACK,
      skills,
      commands: [],
    });
  }

  const result = await applyInstallPlan(
    cwd,
    { targets: planTargets },
    { cliVersion: getCliVersion() }
  );

  if (usingFallback) {
    console.log(
      `No tools detected. Using fallback: ${AGENTS_FALLBACK.installDir}/`
    );
  }

  const skillsByTarget = groupValuesByTarget(
    result.writtenSkills.map((entry) => ({
      target: entry.target,
      value: entry.skill,
    }))
  );
  const commandsByTarget = groupValuesByTarget(
    result.writtenCommands.map((entry) => ({
      target: entry.target,
      value: entry.command,
    }))
  );

  for (const { tool } of planTargets) {
    const targetSkills = skillsByTarget.get(tool.installDir) ?? [];
    const targetCommands = commandsByTarget.get(tool.installDir) ?? [];
    console.log(
      `${tool.name}: installed ${String(targetSkills.length)} skill(s)`
    );
    for (const name of targetSkills) {
      console.log(`  - ${name}`);
    }
    if (targetCommands.length > 0 && tool.commands) {
      console.log(
        `  + ${String(targetCommands.length)} command(s) in ${tool.installDir}/${tool.commands.path}/`
      );
    }
  }
}

function groupValuesByTarget(
  entries: Array<{ target: string; value: string }>
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const { target, value } of entries) {
    const list = map.get(target) ?? [];
    list.push(value);
    map.set(target, list);
  }
  return map;
}

async function detectedLocationDirectories(cwd: string): Promise<string[]> {
  const tools = await detectTools(cwd);
  if (tools.length === 0) return [AGENTS_FALLBACK.installDir];
  return tools.map((t) => t.installDir);
}
