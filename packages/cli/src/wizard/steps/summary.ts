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
      message: buildRemovalConfirmMessage(diff),
      initialValue: true,
    })
  );
}

/**
 * Build an itemized removal confirmation: one clause per target losing
 * content, naming the directory and its removed stub count (skills +
 * commands). Only meaningful when {@link InstallDiff.hasRemovals} is true, so
 * at least one clause is produced in that case.
 */
export function buildRemovalConfirmMessage(diff: InstallDiff): string {
  const clauses: string[] = [];
  for (const entry of diff.entries) {
    const count = entry.removals.skills.length + entry.removals.commands.length;
    if (count === 0) continue;
    clauses.push(
      `${entry.target}/ (${String(count)} stub${count === 1 ? "" : "s"})`
    );
  }
  return `Remove Taskless from ${clauses.join(", ")}?`;
}
