## Why

Users need a way to refine existing rules without starting from scratch. When a rule has false positives, misses edge cases, or needs its fix adjusted, the only option today is to delete and recreate it — losing the generation context. The new `/cli/api/rule/{ruleId}/iterate` endpoint enables iterating on rules with guidance, and the CLI needs a subcommand to expose this.

## What Changes

- Add `rules improve` subcommand to the CLI that accepts a `--from` JSON file with `{ ruleId, guidance, references? }`, submits to the iterate API, polls for results, and writes updated rule/test files
- Add `rules-improve.txt` help file for the new subcommand
- Update the rules help index to include `improve`
- Update the rule API provider to support the iterate endpoint (`POST /cli/api/rule/{ruleId}/iterate`)
- Update `rules create` to accept `successCases`/`failureCases` as arrays (matching the updated API schema), replacing the previous singular `successCase`/`failureCase` string fields — **BREAKING**

## Capabilities

### New Capabilities

- `cli-rules-improve`: The `rules improve` subcommand for iterating on existing rules with guidance via the iterate API endpoint
- `skill-improve-rule`: The `taskless-improve-rule` skill that guides agents through improving existing rules (iterate, replace, or expand)

### Modified Capabilities

- `cli-rules`: Add `improve` to the rules subcommand group and update `create` to use array-based `successCases`/`failureCases`
- `cli-rules-api`: Add the iterate endpoint (`POST /cli/api/rule/{ruleId}/iterate`) and update the rule submission endpoint to use array fields

## Impact

- `packages/cli/src/commands/rules.ts` — New `improve` subcommand, updated `create` field names
- `packages/cli/src/actions/rule-api.ts` — Iterate endpoint types and implementation
- `packages/cli/src/help/rules.txt` — Updated subcommand index
- `packages/cli/src/help/rules-improve.txt` — New help file
- `packages/cli/src/help/rules-create.txt` — Updated field names
- `skills/taskless-improve-rule/SKILL.md` — New skill
- `skills/taskless-create-rule/SKILL.md` — Updated for array fields
