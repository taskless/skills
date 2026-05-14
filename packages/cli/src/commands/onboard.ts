import { resolve } from "node:path";

import { defineCommand } from "citty";

import { ensureTasklessDirectory } from "../filesystem/directory";
import { readManifest, writeManifest } from "../filesystem/migrate";
import { getTelemetry } from "../telemetry";
import { CliError } from "../util/cli-error";

import { getRecipe } from "./help";

export const onboardCommand = defineCommand({
  meta: {
    name: "onboard",
    description:
      "Discover rule candidates from your codebase and history (post-install flow)",
  },
  args: {
    dir: {
      type: "string",
      alias: "d",
      description: "Working directory",
    },
    force: {
      type: "boolean",
      description:
        "Re-run the recipe even when onboarding is already marked complete",
      default: false,
    },
    "mark-complete": {
      type: "boolean",
      description:
        "Record onboarding as complete in .taskless/taskless.json (invoked by the agent after explicit user confirmation)",
      default: false,
    },
  },
  async run({ args }) {
    const cwd = resolve(args.dir ?? process.cwd());
    const telemetry = await getTelemetry(cwd);

    if (args.force && args["mark-complete"]) {
      console.error(
        "Error: --force and --mark-complete cannot be used together."
      );
      console.error(
        "  --force re-runs the discovery recipe; --mark-complete records completion."
      );
      process.exitCode = 1;
      throw new CliError("conflicting flags");
    }

    await ensureTasklessDirectory(cwd);
    const tasklessDirectory = resolve(cwd, ".taskless");

    if (args["mark-complete"]) {
      const { manifest, raw } = await readManifest(tasklessDirectory);
      const install = manifest.install ?? {};
      install.onboarded = true;
      manifest.install = install;
      await writeManifest(tasklessDirectory, manifest, raw);
      console.log("Marked Taskless onboarding as complete.");
      telemetry.capture("cli_onboard_marked_complete");
      return;
    }

    const { manifest } = await readManifest(tasklessDirectory);
    const alreadyOnboarded = manifest.install?.onboarded === true;

    if (alreadyOnboarded && !args.force) {
      console.log("Taskless onboarding is already marked complete.");
      console.log(
        "Run `taskless onboard --force` to re-run the discovery recipe."
      );
      telemetry.capture("cli_onboard_already_done");
      return;
    }

    const recipe = getRecipe("onboard");
    if (recipe === undefined) {
      // Should not happen — onboard.txt is embedded at build time.
      console.error("Internal error: onboard recipe is not available.");
      process.exitCode = 1;
      throw new CliError("recipe missing");
    }
    console.log(recipe.trimEnd());
    telemetry.capture("cli_onboard_recipe", { forced: args.force });
  },
});
