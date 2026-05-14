import { intro, outro, cancel, log } from "@clack/prompts";

import { getOnboardTrailer } from "../commands/onboard";
import { ensureTasklessDirectory } from "../filesystem/directory";
import {
  applyInstallPlan,
  AGENTS_FALLBACK,
  getEmbeddedCommands,
  getEmbeddedSkills,
  TOOLS,
  type EmbeddedCommand,
  type InstallPlanTarget,
  type ToolDescriptor,
} from "../install/install";
import { computeInstallDiff, readInstallState } from "../install/state";
import { getTelemetry } from "../telemetry";

import { WizardCancelled } from "./ask";
import { getCliVersion, renderIntro } from "./intro";
import { promptLocations } from "./steps/locations";
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

/**
 * Lookup map keyed by installDir, derived from the canonical registry.
 *
 * AGENTS_FALLBACK is seeded first so that any registered tool sharing its
 * installDir overwrites it (Object.fromEntries keeps the last value for a
 * duplicate key). Codex's installDir is `.agents` — the same as the
 * fallback — so this ordering ensures `.agents` resolves to Codex when
 * Codex is in TOOLS, while still leaving the fallback descriptor available
 * for users who never had Codex registered.
 */
const TOOL_BY_INSTALL_DIR: Record<string, ToolDescriptor> = Object.fromEntries(
  [AGENTS_FALLBACK, ...TOOLS].map((tool) => [tool.installDir, tool])
);

export async function runWizard(
  options: RunWizardOptions
): Promise<WizardResult> {
  const start = Date.now();
  const telemetry = await getTelemetry(options.cwd);

  let cancelledStep: string | undefined;
  let locations: string[] = [];
  // Optional skills no longer exist post-consolidation — always empty.
  const optionalSkills: string[] = [];
  let authPromptShown = false;
  let authCompleted = false;

  console.error(renderIntro());
  intro(" Taskless setup ");

  try {
    locations = await promptLocations(options.cwd);
    const authResult = await promptAuth(options.cwd);
    authPromptShown = authResult.prompted;
    authCompleted = authResult.loggedIn;

    const embeddedSkills = getEmbeddedSkills();
    const embeddedCommands = getEmbeddedCommands();
    // Catalog has one entry now (`taskless`); install all embedded skills.
    const selectedSkills = embeddedSkills;

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
    const commandsInstalled = planTargets.some((t) => t.commands.length > 0);
    console.log(getOnboardTrailer({ commandsInstalled }));
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
