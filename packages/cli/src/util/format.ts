import type { CheckResult } from "../types/check";

/** Format results as human-readable diagnostic output */
export function formatText(results: CheckResult[]): string {
  if (results.length === 0) {
    return "No issues found.";
  }

  const lines: string[] = [];

  for (const result of results) {
    const location = `${result.file}:${String(result.range.start.line + 1)}:${String(result.range.start.column + 1)}`;
    lines.push(
      `  ${location}`,
      `  ${result.severity}[${result.ruleId}] ${result.message}`,
      `  > ${result.matchedText.split("\n")[0]}`
    );
    if (result.note) {
      lines.push(`  note: ${result.note}`);
    }
    lines.push("");
  }

  // Summary
  const counts: Record<string, number> = {};
  for (const result of results) {
    counts[result.severity] = (counts[result.severity] ?? 0) + 1;
  }

  const parts: string[] = [];
  for (const severity of ["error", "warning", "info", "hint"] as const) {
    const count = counts[severity];
    if (count !== undefined) {
      parts.push(`${String(count)} ${severity}${count === 1 ? "" : "s"}`);
    }
  }

  const uniqueFiles = new Set(results.map((r) => r.file)).size;
  lines.push(
    `${String(results.length)} issue${results.length === 1 ? "" : "s"} (${parts.join(", ")}) across ${String(uniqueFiles)} file${uniqueFiles === 1 ? "" : "s"}`
  );

  return lines.join("\n");
}
