# Skills

## MODIFIED Requirements

### Requirement: Skills use SKILL.md format with YAML frontmatter

The single skill SHALL be defined at `skills/taskless/SKILL.md` with YAML frontmatter (`name`, `description`, `metadata`) followed by markdown instructions. The `name` field SHALL be exactly `taskless` (no per-task prefix). The `metadata` field SHALL include `author`, `version`, and `commandName: tskl` keys. The `version` SHALL be used for staleness detection when the skill is installed into target repositories.

The skill body SHALL begin by instructing the agent that it does NOT have step-by-step instructions for any Taskless action and that recipes must be fetched via `npx @taskless/cli help <topic>` before proceeding. The body SHALL NOT contain inline step-by-step recipes for any individual task — those live in `packages/cli/src/help/<topic>.txt` files served by the help subcommand.

#### Scenario: Skill directory contains valid SKILL.md

- **WHEN** the skill is built
- **THEN** `skills/taskless/SKILL.md` SHALL exist
- **AND** SHALL contain YAML frontmatter with `name: taskless` and `description` (up to 1024 chars)
- **AND** the `metadata` field SHALL include `author: taskless`, `version` (string matching CLI package version), and `commandName: tskl`
- **AND** the markdown body SHALL contain the router instructions described above (no per-task recipes inline)

#### Scenario: Skill body delegates to CLI help

- **WHEN** the skill body is read
- **THEN** it SHALL instruct the agent to fetch the canonical recipe via `npx @taskless/cli help <topic>` before performing any Taskless action
- **AND** SHALL NOT duplicate recipe content inline

### Requirement: Skill names are globally qualified with taskless prefix

The single skill name SHALL be `taskless` (without a per-task suffix). When installed into a target tool, the skill SHALL be installed at `<tool>/skills/taskless/SKILL.md` (e.g. `.claude/skills/taskless/SKILL.md`).

#### Scenario: Skill name is exactly taskless

- **WHEN** the skill is installed into any tool location
- **THEN** the directory name SHALL be `taskless`
- **AND** SHALL NOT use a `taskless-<task>` per-task name

### Requirement: Commands directory contains Claude Code command files

The `commands/tskl/` directory SHALL contain exactly one command file (`tskl.md`) that maps to the consolidated skill. The command body SHALL accept a free-form `$ARGUMENTS` ask and route via the same flow as the skill (fetch `npx @taskless/cli help <topic>`, follow the recipe). When `$ARGUMENTS` is empty or ambiguous, the command body SHALL instruct the agent to ask the user what they want to do.

#### Scenario: Single command file exists

- **WHEN** the v0.7.0 release is built
- **THEN** `commands/tskl/tskl.md` SHALL exist
- **AND** no other command files SHALL exist in `commands/tskl/`

#### Scenario: Command file is a router

- **WHEN** the command body is read
- **THEN** it SHALL instruct the agent to handle `$ARGUMENTS` by inferring a topic, fetching its recipe, and proceeding
- **AND** SHALL specify behavior when `$ARGUMENTS` is empty (ask the user)

### Requirement: Plugin manifest declares skills and commands

The `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` SHALL declare the single consolidated skill and the single command. The plugin version SHALL be `0.7.0` for this release. The plugin description MAY be updated to reflect the consolidation.

#### Scenario: Plugin manifest reflects consolidated bundle

- **WHEN** `plugin.json` is read
- **THEN** `version` SHALL be `0.7.0`
- **AND** `commands` SHALL point to `./commands/tskl/`
- **AND** the bundled commands directory SHALL contain only `tskl.md`

## REMOVED Requirements

### Requirement: Info skill confirms Taskless is working

**Reason**: The `taskless-info` skill is removed; "info" is now a topic accessed via `tskl help info`.

**Migration**: Info instructions move into `packages/cli/src/help/info.txt`. The CLI command `taskless info` is unchanged.

### Requirement: Check skill uses --json flag for machine-readable output

**Reason**: The `taskless-check` skill is removed; check is now a topic accessed via `tskl help check`.

**Migration**: Check recipe instructions move into `packages/cli/src/help/check.txt`. The CLI command and its `--json` flag are unchanged.

### Requirement: Login skill delegates documentation to CLI help

**Reason**: The `taskless-login` skill is removed; login is now a branch within `tskl help auth`.

**Migration**: Login instructions move into `packages/cli/src/help/auth.txt` under the login branch.

### Requirement: Logout skill delegates documentation to CLI help

**Reason**: The `taskless-logout` skill is removed; logout is now a branch within `tskl help auth`.

**Migration**: Logout instructions move into `packages/cli/src/help/auth.txt` under the logout branch.

### Requirement: Rule create skill uses --json flag and delegates docs to help

**Reason**: The `taskless-create-rule` skill is removed; rule create is now a topic accessed via `tskl help rule create`.

**Migration**: Recipe instructions move into `packages/cli/src/help/rule-create.txt` (API-backed) and `packages/cli/src/help/rule-create.anonymous.txt` (local-only). See `skill-create-rule` for full migration notes.

### Requirement: Rule delete skill delegates docs to help

**Reason**: The `taskless-delete-rule` skill is removed; rule delete is now a topic accessed via `tskl help rule delete`.

**Migration**: Recipe instructions move into `packages/cli/src/help/rule-delete.txt`. See `skill-delete-rule`.
