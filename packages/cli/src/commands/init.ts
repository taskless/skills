import { resolve } from "node:path";
import { defineCommand } from "citty";

import { ensureTasklessDirectory } from "../filesystem/directory";
import {
  applyInstallPlan,
  buildInstallPlan,
  DEFAULT_SHIM_DIR,
  detectSelectedDirectories,
  detectTools,
  getEmbeddedCommands,
  getEmbeddedSkills,
} from "../install/install";
import { getMandatorySkillNames } from "../install/catalog";
import { getTelemetry } from "../telemetry";
import { runWizard } from "../wizard";
import { getCliVersion } from "../wizard/intro";

import { getOnboardTrailer } from "./onboard";

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
    anonymous: {
      type: "boolean",
      description: "Accepted for compatibility; init has no auth dependency",
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
    const result = await runNonInteractive(cwd);
    console.log(
      getOnboardTrailer({ commandsInstalled: result.commandsInstalled })
    );
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

export const updateCommand = defineCommand({
  meta: {
    name: "update",
    description:
      "Update Taskless skills in detected tools (non-interactive install)",
  },
  args: {
    dir: {
      type: "string",
      alias: "d",
      description: "Working directory",
    },
    anonymous: {
      type: "boolean",
      description: "Accepted for compatibility; update has no auth dependency",
      default: false,
    },
  },
  async run({ args }) {
    const cwd = resolve(args.dir ?? process.cwd());
    const telemetry = await getTelemetry(cwd);
    const startedAt = Date.now();
    telemetry.capture("cli_update");

    let success = false;
    try {
      await runNonInteractive(cwd);
      success = true;
    } finally {
      telemetry.capture("cli_update_completed", {
        locations: await detectedLocationDirectories(cwd),
        success,
        durationMs: Date.now() - startedAt,
      });
    }
  },
});

async function runNonInteractive(
  cwd: string
): Promise<{ commandsInstalled: boolean }> {
  await ensureTasklessDirectory(cwd);

  const allSkills = getEmbeddedSkills();
  const mandatoryNames = new Set(getMandatorySkillNames());
  const skills = allSkills.filter((s) => mandatoryNames.has(s.name));
  const commands = getEmbeddedCommands();

  const detected = await detectTools(cwd);
  const selectedDirectories = await detectSelectedDirectories(cwd);
  const plan = buildInstallPlan(selectedDirectories, skills, commands);
  const commandsInstalled = plan.targets.some(
    (t) => t.mode === "reference" && t.commands.length > 0
  );

  const result = await applyInstallPlan(cwd, plan, {
    cliVersion: getCliVersion(),
  });

  if (detected.length === 0) {
    console.log(`No tools detected. Using fallback: ${DEFAULT_SHIM_DIR}/`);
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
  const removedSkillsByTarget = groupValuesByTarget(
    result.removedSkills.map((entry) => ({
      target: entry.target,
      value: entry.skill,
    }))
  );
  const removedCommandsByTarget = groupValuesByTarget(
    result.removedCommands.map((entry) => ({
      target: entry.target,
      value: entry.command,
    }))
  );

  for (const target of plan.targets) {
    const writtenSkills = skillsByTarget.get(target.dir) ?? [];
    const writtenCommands = commandsByTarget.get(target.dir) ?? [];
    const removedSkills = removedSkillsByTarget.get(target.dir) ?? [];
    const removedCommands = removedCommandsByTarget.get(target.dir) ?? [];
    const noun = target.mode === "canonical" ? "canonical file" : "stub";

    if (
      writtenSkills.length === 0 &&
      writtenCommands.length === 0 &&
      removedSkills.length === 0 &&
      removedCommands.length === 0
    ) {
      console.log(`${target.label} (${target.dir}/): up to date`);
      continue;
    }

    console.log(
      `${target.label} (${target.dir}/): wrote ${String(writtenSkills.length)} skill ${noun}(s)`
    );
    for (const name of writtenSkills) {
      console.log(`  - ${name}`);
    }
    if (writtenCommands.length > 0) {
      console.log(`  + ${String(writtenCommands.length)} command ${noun}(s)`);
    }
    if (removedSkills.length > 0) {
      console.log(
        `  removed ${String(removedSkills.length)} obsolete skill(s):`
      );
      for (const name of removedSkills) {
        console.log(`    - ${name}`);
      }
    }
    if (removedCommands.length > 0) {
      console.log(
        `  removed ${String(removedCommands.length)} obsolete command(s):`
      );
      for (const name of removedCommands) {
        console.log(`    - ${name}`);
      }
    }
  }

  return { commandsInstalled };
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
  return detectSelectedDirectories(cwd);
}
