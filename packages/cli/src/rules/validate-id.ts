/**
 * Pattern for valid rule IDs: lowercase alphanumeric with hyphens.
 * Prevents path traversal and shell injection via rule ID inputs.
 */
const VALID_RULE_ID = /^[a-z0-9][a-z0-9-]*$/;

/** Check whether a rule ID is safe to use in file paths and CLI arguments */
export function isValidRuleId(id: string): boolean {
  return VALID_RULE_ID.test(id);
}
