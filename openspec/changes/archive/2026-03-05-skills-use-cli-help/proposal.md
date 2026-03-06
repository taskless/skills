## Why

Agent skills currently hardcode CLI usage documentation, output format descriptions, and example commands in their SKILL.md files. The `cli-help-subcommand` change introduces `taskless help <command>` as the single source of truth for command documentation. Skills should delegate to the CLI's help output instead of duplicating it, keeping skill instructions always current and reducing maintenance burden.

## What Changes

- Refactor all 6 skills (`taskless-info`, `taskless-check`, `taskless-login`, `taskless-logout`, `taskless-rule-create`, `taskless-rule-delete`) to invoke `taskless help <command>` for usage documentation instead of hardcoding it
- Skills that run CLI commands with JSON output (`check`, `info`, `rules create`) should prefer the `--json` flag when available
- Skills should use the examples from help output to construct their CLI invocations
- Remove hardcoded output format descriptions, option lists, and example commands from skill files

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `skills`: Update skill instruction patterns to delegate usage documentation to `taskless help` and prefer JSON output where the CLI supports `--json`

## Impact

- `skills/taskless-info/SKILL.md`: Refactor to call `taskless help info` for docs
- `skills/taskless-check/SKILL.md`: Refactor to call `taskless help check` for docs, use `--json`
- `skills/taskless-login/SKILL.md`: Refactor to call `taskless help auth login` for docs
- `skills/taskless-logout/SKILL.md`: Refactor to call `taskless help auth logout` for docs
- `skills/taskless-rule-create/SKILL.md`: Refactor to call `taskless help rules create` for docs, use `--json`
- `skills/taskless-rule-delete/SKILL.md`: Refactor to call `taskless help rules delete` for docs
