# CLI Init

## MODIFIED Requirements

### Requirement: Init subcommand installs skills into a repository

The CLI SHALL support a `taskless init` subcommand that installs the consolidated `taskless` skill into the current working directory's detected tool locations. The subcommand SHALL also be available as `taskless update` (alias). By default, `init` SHALL launch the interactive wizard. When invoked with `--no-interactive`, `init` SHALL preserve the prior batch-install behavior: install the consolidated skill to every detected tool location (or `.agents/` fallback when none detected) without prompting and without an auth step.

There is exactly one mandatory skill in v0.7.0 (`taskless`) and zero optional skills. The wizard's optional-skill selection step SHALL be removed.

The `--anonymous` flag is accepted on `init` as a no-op (init does not call the Taskless API directly).

#### Scenario: Running taskless init installs the consolidated skill

- **WHEN** a user runs `taskless init` in an interactive terminal
- **THEN** the wizard SHALL prompt for tool locations and auth, then install the single `taskless` skill
- **AND** SHALL NOT prompt for optional skills (none exist)

#### Scenario: Init removes obsolete v0.6 skill files

- **WHEN** a user with v0.6 installed (10 per-task skills written) runs the v0.7.0 `taskless init`
- **THEN** the install plumbing SHALL read the previous install state from `.taskless/taskless.json`
- **AND** SHALL delete the 10 obsolete skill files and 6 obsolete command files
- **AND** SHALL write the new `taskless` skill and `tskl` command
- **AND** SHALL update `.taskless/taskless.json` install state to reflect the new layout

#### Scenario: Init reports cleanup transparently

- **WHEN** init removes obsolete files
- **THEN** the install summary output SHALL include "removed N obsolete skills" and "removed M obsolete commands"
- **AND** SHALL list the obsolete skill names so the user understands what changed

### Requirement: Bare taskless invocation launches the init wizard

The CLI entry point SHALL delegate to `init` when invoked with no positional subcommand AND a TTY is attached. When stdout is NOT a TTY, bare `taskless` SHALL print a non-interactive preamble explaining the context, followed by the help index (instead of attempting the wizard or printing only top-level help).

#### Scenario: Bare taskless in a TTY launches the wizard

- **WHEN** a user runs `taskless` with no subcommand and stdout is a TTY
- **THEN** the CLI SHALL behave as if `taskless init` were invoked

#### Scenario: Bare taskless without a TTY prints preamble + help index

- **WHEN** `taskless` is invoked with no subcommand and stdout is not a TTY
- **THEN** the CLI SHALL print a short preamble noting the non-interactive context (e.g. "For interactive install, run from a terminal. For agent recipes, use: taskless help")
- **AND** SHALL then print the help index (same content as `taskless help`)
- **AND** SHALL NOT launch the wizard
- **AND** SHALL NOT silently install

### Requirement: Wizard prompts the user to choose install locations

The wizard's location step is unchanged in shape but the resulting install plan only ever contains the single `taskless` skill (and its corresponding `tskl` command).

### Requirement: Wizard prompts the user to choose optional skills

REMOVED in this change — see "Optional skill selection step is removed" below.

### Requirement: Install manifest records what was installed per target

The install manifest in `.taskless/taskless.json` continues to record what was written per target. With one skill in the bundle, each target's `skills` array contains at most `["taskless"]` and each target's `commands` array contains at most `["tskl"]`. The manifest schema is unchanged — only the contents differ.

#### Scenario: Manifest records the consolidated skill

- **WHEN** init writes the consolidated skill to `.claude/`
- **THEN** the manifest's `install.targets[".claude"].skills` SHALL be `["taskless"]`
- **AND** `install.targets[".claude"].commands` SHALL be `["tskl"]`

### Requirement: Re-install computes a diff against the previous manifest

Re-install diff computation is unchanged. With v0.7.0 the diff for a v0.6 user shows 10 skill removals + 6 command removals + 1 skill addition + 1 command addition per detected target. Removals require user confirmation per the existing requirement.

#### Scenario: Upgrade from v0.6 shows removals in summary

- **WHEN** a user with v0.6 installed runs `taskless init` after upgrading to v0.7.0
- **THEN** the wizard summary SHALL list the 10 obsolete skills and 6 obsolete commands as removals
- **AND** SHALL require user confirmation before deleting

## REMOVED Requirements

### Requirement: Init installs anonymous skill variants

**Reason**: There are no longer separate anonymous skill files. Anonymous mode is reached via the global `--anonymous` flag on individual CLI commands.

**Migration**: See `cli` for the global flag, `cli-rules` for the per-command anonymous behavior, and `cli-help` for the recipe variant lookup.

### Requirement: Wizard prompts the user to choose optional skills

**Reason**: There are no optional skills in v0.7.0 — the catalog reduces to a single mandatory skill. The wizard's optional-skill multi-select step is removed entirely.

**Migration**: The CI capability (previously the only optional skill) becomes a topic discoverable via `tskl help ci`. No wizard interaction is required.
