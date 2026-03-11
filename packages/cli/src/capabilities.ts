/** Validate that a string is a YYYY-MM-DD or YYYY-MM-DD.patch spec version */
export function isValidSpecVersion(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})(\.\d+)?$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

/**
 * Per-subcommand minimum scaffold version.
 * Each subcommand declares the minimum `.taskless/taskless.json` version it requires.
 * YYYY-MM-DD strings sort lexicographically, so string comparison is sufficient.
 */
export const MIN_SCAFFOLD_VERSION: Record<string, string> = {
  "rules create": "2026-03-02",
  check: "2026-02-18",
};

/** Check whether a scaffold version meets the minimum for a given subcommand */
export function isScaffoldVersionSufficient(
  subcommand: string,
  version: string
): boolean {
  const minimum = MIN_SCAFFOLD_VERSION[subcommand];
  if (!minimum) return true; // no minimum declared for this subcommand
  return version >= minimum;
}
