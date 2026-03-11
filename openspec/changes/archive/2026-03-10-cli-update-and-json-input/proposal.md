## Why

The CLI has three usability gaps that block rule generation workflows. First, when a project's spec version is too old for rules, the error directs users to "re-run taskless init" — but init doesn't update `taskless.json`, creating an unresolvable loop. Users need a proper update path that upgrades their `.taskless/` engine directory via a backend-generated PR. Second, the `rules create` command only accepts JSON via stdin pipe, which breaks in zsh (where `echo` interprets `\n` as literal newlines, corrupting JSON string values). Skills constructing the CLI invocation hit shell escaping issues or produce compound commands (heredocs) that may be blocked by agent deny-lists. Third, the version compatibility system uses overlapping concepts (`COMPATIBILITY` ranges, `RULES_MIN_SPEC_VERSION`, `isRulesCompatibleVersion`) that should be unified into a single per-subcommand minimum version model.

## What Changes

- Replace `COMPATIBILITY` ranges and `RULES_MIN_SPEC_VERSION` with a per-subcommand minimum scaffold version map — version checking is purely local, no API calls needed
- Add `taskless update-engine` as a distinct command (separate from `init`) that requests a scaffold upgrade PR via `POST /cli/api/update-engine`
- Replace stdin JSON input on `rules create` with a `--from <file>` flag, removing the stdin path entirely
- Update error messages to direct users to `taskless update-engine` with a clear message showing current vs required version
- Create `taskless:update-engine` skill for agent-driven scaffold upgrades
- Update `taskless:rules-create` skill to use `--from` file-based input

## Capabilities

### New Capabilities

- `cli-update-engine`: The `taskless update-engine --json` subcommand and its API contract (`POST /cli/api/update-engine`, `GET /cli/api/update-engine/:requestId`) — POSTs to backend, polls for PR creation, reports status
- `skill-update-engine`: The `taskless-update-engine` skill that invokes the update-engine CLI and reports PR status to the user

### Modified Capabilities

- `cli-rules`: Replace stdin JSON input with `--from <file>` flag; version checking uses per-subcommand minimum version
- `skill-rules-create`: Switch from `echo '<json>' | ...` stdin piping to writing a temp file and using `--from <file>` flag
- `cli`: Register `update-engine` as a new subcommand; remove `update` alias for `init`; replace `COMPATIBILITY` ranges with per-subcommand minimum scaffold version map

## Impact

- **CLI package** (`packages/cli/`): New `update-engine` command, refactored `capabilities.ts` (per-subcommand minimums replace ranges), modified `rules create` command (replace stdin with `--from` flag), new API action for update-engine endpoints
- **Skills** (`skills/`): New `taskless-update-engine` skill, modified `taskless-rule-create` skill
- **Commands** (`commands/taskless/`): New `update-engine.md` command file for Claude Code
- **API contract**: New `/cli/api/update-engine` and `/cli/api/update-engine/:requestId` endpoints (implementation lives in backend, spec documented here)
- **Tests**: New tests for `--from` file input parsing, per-subcommand version validation
