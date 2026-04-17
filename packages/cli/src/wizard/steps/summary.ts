import { confirm, log } from "@clack/prompts";
import pc from "picocolors";

import type { InstallDiff } from "../../install/state";
import { ask } from "../ask";

export async function renderSummaryAndConfirm(
  diff: InstallDiff
): Promise<boolean> {
  const lines: string[] = [];

  for (const entry of diff.entries) {
    const hasAnyChange =
      entry.additions.skills.length > 0 ||
      entry.additions.commands.length > 0 ||
      entry.removals.skills.length > 0 ||
      entry.removals.commands.length > 0;

    if (!hasAnyChange && entry.unchanged.skills.length === 0) continue;

    lines.push(pc.bold(entry.target));
    for (const skill of entry.additions.skills) {
      lines.push(`  ${pc.green("+")} skill ${skill}`);
    }
    for (const command of entry.additions.commands) {
      lines.push(`  ${pc.green("+")} command ${command}`);
    }
    for (const skill of entry.removals.skills) {
      lines.push(`  ${pc.red("-")} skill ${skill}`);
    }
    for (const command of entry.removals.commands) {
      lines.push(`  ${pc.red("-")} command ${command}`);
    }
    if (entry.unchanged.skills.length > 0) {
      lines.push(
        `  ${pc.dim("·")} ${pc.dim(
          `${entry.unchanged.skills.length} skill(s) unchanged`
        )}`
      );
    }
    lines.push("");
  }

  log.message(lines.join("\n") || "No changes.");

  if (!diff.hasRemovals) {
    return true;
  }

  return ask("summary", () =>
    confirm({
      message:
        "Some files will be removed from locations recorded in the previous install. Proceed?",
      initialValue: true,
    })
  );
}
