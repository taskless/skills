import { intro, outro, cancel, log } from "@clack/prompts";

import { ensureTasklessDirectory } from "../filesystem/directory";
import { SKILL_CATALOG } from "../install/catalog";
import {
  applyInstallPlan,
  AGENTS_FALLBACK,
  getEmbeddedCommands,
  getEmbeddedSkills,
  type EmbeddedSkill,
  type EmbeddedCommand,
  type InstallPlanTarget,
  type ToolDescriptor,
} from "../install/install";
import { computeInstallDiff, readInstallState } from "../install/state";
import { getTelemetry } from "../telemetry";

import { WizardCancelled } from "./ask";
import { getCliVersion, renderIntro } from "./intro";
import { promptLocations } from "./steps/locations";
import { promptOptionalSkills } from "./steps/optional-skills";
import { promptAuth } from "./steps/auth";
import { renderSummaryAndConfirm } from "./steps/summary";

export interface RunWizardOptions {
  cwd: string;
}

export interface WizardResult {
  status: "completed" | "cancelled";
  locations: string[];
  optionalSkills: string[];
  authPromptShown: boolean;
  authCompleted: boolean;
  durationMs: number;
  cancelledStep?: string;
}

const TOOL_BY_INSTALL_DIR: Record<string, ToolDescriptor> = {
  ".claude": {
    name: "Claude Code",
    detect: [
      { type: "directory", path: ".claude" },
      { type: "file", path: "CLAUDE.md" },
    ],
    installDir: ".claude",
    skills: { path: "skills" },
    commands: { path: "commands/tskl" },
  },
  ".opencode": {
    name: "OpenCode",
    detect: [
      { type: "directory", path: ".opencode" },
      { type: "file", path: "opencode.jsonc" },
      { type: "file", path: "opencode.json" },
    ],
    installDir: ".opencode",
    skills: { path: "skills" },
  },
  ".cursor": {
    name: "Cursor",
    detect: [
      { type: "directory", path: ".cursor" },
      { type: "file", path: ".cursorrules" },
    ],
    installDir: ".cursor",
    skills: { path: "skills" },
  },
  ".agents": AGENTS_FALLBACK,
};

function resolveSkillsForSelection(
  embeddedSkills: EmbeddedSkill[],
  optionalSelection: string[]
): EmbeddedSkill[] {
  const optionalSet = new Set(optionalSelection);
  const result: EmbeddedSkill[] = [];
  for (const descriptor of SKILL_CATALOG) {
    const include = !descriptor.optional || optionalSet.has(descriptor.name);
    if (!include) continue;
    const embedded = embeddedSkills.find((s) => s.name === descriptor.name);
    if (embedded) result.push(embedded);
  }
  return result;
}

export async function runWizard(
  options: RunWizardOptions
): Promise<WizardResult> {
  const start = Date.now();
  const telemetry = await getTelemetry(options.cwd);

  let cancelledStep: string | undefined;
  let locations: string[] = [];
  let optionalSkills: string[] = [];
  let authPromptShown = false;
  let authCompleted = false;

  console.error(renderIntro());
  intro(" Taskless setup ");

  try {
    locations = await promptLocations(options.cwd);
    optionalSkills = await promptOptionalSkills();
    const authResult = await promptAuth(options.cwd);
    authPromptShown = authResult.prompted;
    authCompleted = authResult.loggedIn;

    const embeddedSkills = getEmbeddedSkills();
    const embeddedCommands = getEmbeddedCommands();
    const selectedSkills = resolveSkillsForSelection(
      embeddedSkills,
      optionalSkills
    );

    const planTargets: InstallPlanTarget[] = locations.map((directory) => {
      const tool = TOOL_BY_INSTALL_DIR[directory];
      if (!tool) {
        throw new Error(`Unknown install location: ${directory}`);
      }
      return {
        tool,
        skills: selectedSkills,
        commands: tool.commands ? embeddedCommands : [],
      };
    });

    const previousState = await readInstallState(options.cwd);
    const nextStateForDiff = {
      installedAt: previousState.installedAt,
      cliVersion: previousState.cliVersion,
      targets: Object.fromEntries(
        planTargets.map((t) => [
          t.tool.installDir,
          {
            skills: t.skills.map((s) => s.name),
            commands: t.commands.map((c: EmbeddedCommand) => c.filename),
          },
        ])
      ),
    };
    const diff = computeInstallDiff(previousState, nextStateForDiff);

    const proceed = await renderSummaryAndConfirm(diff);
    if (!proceed) {
      cancel("Install cancelled. Run `taskless init` to try again.");
      cancelledStep = "summary";
      return finish({ status: "cancelled" });
    }

    await ensureTasklessDirectory(options.cwd, {
      onNotice: (message) => log.info(message),
    });
    await applyInstallPlan(
      options.cwd,
      { targets: planTargets },
      { cliVersion: getCliVersion() }
    );

    outro("Taskless is ready to go.");
    return finish({ status: "completed" });
  } catch (error) {
    if (error instanceof WizardCancelled) {
      cancel(
        `Wizard cancelled at step "${error.step}". Run \`taskless init\` to try again.`
      );
      cancelledStep = error.step;
      return finish({ status: "cancelled" });
    }
    throw error;
  }

  function finish(args: { status: "completed" | "cancelled" }): WizardResult {
    const durationMs = Date.now() - start;
    if (args.status === "completed") {
      telemetry.capture("cli_init_completed", {
        locations,
        optionalSkills,
        authPromptShown,
        authCompleted,
        nonInteractive: false,
        durationMs,
      });
    } else {
      telemetry.capture("cli_init_cancelled", {
        atStep: cancelledStep ?? "unknown",
        durationMs,
      });
    }
    return {
      status: args.status,
      locations,
      optionalSkills,
      authPromptShown,
      authCompleted,
      durationMs,
      cancelledStep,
    };
  }
}

/** Re-export so callers can detect wizard cancellation by class. */
export { WizardCancelled } from "./ask";
