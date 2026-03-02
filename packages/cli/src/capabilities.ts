/** Validate that a string is a YYYY-MM-DD or YYYY-MM-DD.patch spec version */
export function isValidSpecVersion(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})(\.\d+)?$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

/** A supported version range. Omit `end` for the latest open-ended range. */
export interface Compatibility {
  start: string;
  end?: string;
}

/**
 * Version ranges this CLI supports.
 * Each range covers [start, end). Omit `end` for the current/latest range.
 * When a breaking spec change ships, close the current range and add a new one.
 */
export const COMPATIBILITY: Compatibility[] = [
  // initial release, ast-grep 0.41 compatibility
  { start: "2026-02-18" },
];

/** Check whether the CLI supports a given spec version */
export function isSupportedSpecVersion(version: string): boolean {
  if (!isValidSpecVersion(version)) return false;
  return COMPATIBILITY.some(
    (range) =>
      version >= range.start && (range.end === undefined || version < range.end)
  );
}
