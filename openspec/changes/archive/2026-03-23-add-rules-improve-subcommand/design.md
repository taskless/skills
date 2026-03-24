## Context

The CLI has `rules create` and `rules delete` subcommands. The backend added `POST /cli/api/rule/{ruleId}/iterate` which accepts `{ orgId, guidance, references? }` and returns a `requestId` that uses the same polling endpoint (`GET /cli/api/rule/{ruleId}`) as rule creation. The iterate endpoint enables refining an existing rule without losing generation context.

Concurrently, the API schema changed `successCase`/`failureCase` (singular strings) to `successCases`/`failureCases` (arrays of strings) on the rule creation endpoint. The CLI has also been migrated to `openapi-fetch` + `openapi-typescript` for schema-driven type safety.

## Goals / Non-Goals

**Goals:**

- Add `rules improve` subcommand following the same patterns as `rules create` (`--from` JSON input, polling, file writing)
- Add the `taskless-improve-rule` skill to guide agents through a decision tree for rule improvement
- Update `rules create` to accept array-based example fields matching the new schema

**Non-Goals:**

- Interactive/prompt-based improve flow (the `--from` JSON pattern is sufficient)
- Automatic detection of which rules need improvement (the skill handles this decision-making)
- Changes to the polling mechanism or file writing logic (reuse existing infrastructure)

## Decisions

### Subcommand named `improve` not `iterate`

The API endpoint uses "iterate" but the user-facing command is `improve` — it's more intuitive for end users. The skill is `taskless-improve-rule`. The internal API function remains `iterateRule()` to match the endpoint name.

### Reuse the same polling and file-writing infrastructure as `create`

The iterate endpoint returns a `requestId` that polls via the same `GET /cli/api/rule/{ruleId}` endpoint. The `improveCommand` reuses `pollRuleStatus()`, `writeRuleFile()`, and `writeRuleTestFile()` identically. This avoids duplicating polling/writing logic.

### Skill uses a decision tree rather than always iterating

The `taskless-improve-rule` skill doesn't blindly call the iterate endpoint. It guides the agent through evaluating whether to: (A) iterate on the existing rule, (B) replace it entirely via create+delete, or (C) expand into multiple rules. This puts the intelligence in the skill layer, not the CLI.

### The `--from` JSON includes `ruleId` in the file payload

Rather than making `ruleId` a CLI argument, it's included in the JSON file alongside `guidance` and `references`. This keeps the interface consistent with `rules create --from` and allows the skill to construct a single file with all needed context.

## Risks / Trade-offs

- **Breaking change on `successCase`/`failureCase` → arrays**: Skills that wrote the old singular-string format will break. → Mitigation: The skill instructions were updated simultaneously. No external consumers use this yet.
- **`ruleId` must be known by the caller**: The iterate endpoint requires the original generation `ruleId`, not the rule filename. → Mitigation: The skill instructions explain where to find this (rule YAML metadata), and the help text documents the field.
