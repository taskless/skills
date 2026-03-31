import { z } from "zod";

import astGrepSchema from "../generated/ast-grep-rule-schema.json";

/**
 * Zod schema for ast-grep rule validation, derived from the official
 * ast-grep JSON Schema via `z.fromJSONSchema()`. This gives us full
 * validation coverage matching the upstream spec.
 *
 * The raw JSON Schema is also embedded for agent consumption via
 * `rules verify --schema`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
export const astGrepRuleSchema = z.fromJSONSchema(astGrepSchema as any);

/**
 * Taskless-specific required fields, beyond what ast-grep requires.
 * ast-grep only requires `rule` + `language`; Taskless also requires
 * `id`, `severity`, and `message` for meaningful rule output.
 */
export const TASKLESS_REQUIRED_FIELDS = [
  "id",
  "language",
  "severity",
  "message",
  "rule",
] as const;

/**
 * Check if a rule object uses `regex` anywhere without a sibling `kind`.
 * Recursively walks the rule tree.
 */
export function findRegexWithoutKind(
  object: Record<string, unknown>,
  path = ""
): string[] {
  const errors: string[] = [];

  if ("regex" in object && !("kind" in object)) {
    errors.push(
      `${path || "rule"}: uses "regex" without a sibling "kind" field. Regex matches without kind are ambiguous and slow.`
    );
  }

  // Recurse into known composite fields
  for (const key of [
    "any",
    "all",
    "not",
    "has",
    "inside",
    "precedes",
    "follows",
  ]) {
    const value = object[key];
    if (Array.isArray(value)) {
      for (const [index, item] of value.entries()) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          errors.push(
            ...findRegexWithoutKind(
              item as Record<string, unknown>,
              `${path || "rule"}.${key}[${String(index)}]`
            )
          );
        }
      }
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      errors.push(
        ...findRegexWithoutKind(
          value as Record<string, unknown>,
          `${path || "rule"}.${key}`
        )
      );
    }
  }

  return errors;
}
