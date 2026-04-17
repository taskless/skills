## MODIFIED Requirements

### Requirement: Init subcommand installs skills into a repository

The CLI SHALL support a `taskless init` subcommand that installs Taskless skills into the current working directory. The subcommand SHALL also be available as `taskless update` (alias with identical behavior). By default, `init` SHALL launch the interactive wizard. When invoked with `--no-interactive`, `init` SHALL preserve the prior batch-install behavior: install every mandatory skill to every detected tool location, with no prompts and no auth step. When no tool directories are detected AND the CLI runs with `--no-interactive` (or the wizard user explicitly selects none of the detected locations and falls back), the CLI SHALL install skills to `.agents/skills/<name>/SKILL.md` as a fallback.

#### Scenario: Running taskless init launches the wizard by default

- **WHEN** a user runs `taskless init` without `--no-interactive` in an interactive terminal
- **THEN** the CLI SHALL launch the interactive wizard instead of silently installing

#### Scenario: Running taskless init --no-interactive installs mandatory skills to all detected locations

- **WHEN** a user runs `taskless init --no-interactive` in a repository with at least one detected AI tool
- **THEN** the CLI SHALL write every mandatory skill into each detected tool's directory without prompting
- **AND** SHALL NOT write any optional skills
- **AND** SHALL NOT prompt for authentication
- **AND** SHALL report which tools were updated and how many skills were installed

#### Scenario: Running taskless update behaves identically to init

- **WHEN** a user runs `taskless update`
- **THEN** the behavior SHALL be identical to `taskless init`

#### Scenario: Running init --no-interactive with no detected tools uses fallback

- **WHEN** a user runs `taskless init --no-interactive` in a repository with no detected AI tool signals
- **THEN** the CLI SHALL install mandatory skills to `.agents/skills/`
- **AND** report that the fallback location was used

## ADDED Requirements

### Requirement: Bare taskless invocation launches the init wizard

The CLI entry point SHALL delegate to `init` when invoked with no positional subcommand and a TTY is attached. When stdout is not a TTY (e.g., piped, non-interactive shell), bare `taskless` SHALL instead print the top-level help as it does today. Users SHALL continue to be able to view top-level help explicitly via `taskless help`.

#### Scenario: Bare taskless in a TTY launches the wizard

- **WHEN** a user runs `taskless` with no subcommand and stdout is a TTY
- **THEN** the CLI SHALL behave as if `taskless init` were invoked

#### Scenario: Bare taskless without a TTY prints help

- **WHEN** `taskless` is invoked with no subcommand and stdout is not a TTY
- **THEN** the CLI SHALL print the top-level help text
- **AND** SHALL NOT launch the wizard

#### Scenario: Explicit help command still works

- **WHEN** a user runs `taskless help`
- **THEN** the CLI SHALL print the top-level help text regardless of TTY state

### Requirement: Wizard renders an intro banner

The wizard SHALL begin by rendering an ASCII rendition of the Taskless wordmark followed by the CLI version, styled with `picocolors` for color output. The banner SHALL downgrade gracefully when colors are disabled (e.g., `NO_COLOR=1` or non-TTY). The exact ASCII art is not fixed by this requirement and MAY be iterated in follow-up changes.

#### Scenario: Wizard prints a banner on start

- **WHEN** the wizard starts
- **THEN** an ASCII banner SHALL be written to stderr before any prompts

#### Scenario: Banner honors NO_COLOR

- **WHEN** `NO_COLOR=1` is set in the environment
- **THEN** the banner SHALL be rendered without ANSI color escapes

### Requirement: Wizard prompts the user to choose install locations

The wizard SHALL present a multi-select prompt listing all four known install locations (`.claude/`, `.opencode/`, `.cursor/`, `.agents/`) regardless of which are detected. Detected locations SHALL be pre-checked. Undetected locations SHALL be shown unchecked with a visual indicator that they are not currently present. The wizard SHALL NOT allow the user to confirm zero selections; if the user unchecks all locations, the wizard SHALL re-prompt with an inline validation error until at least one location is selected.

#### Scenario: Detected locations are pre-checked

- **WHEN** the wizard reaches the locations step in a repository with `.claude/` and `.cursor/`
- **THEN** the multi-select SHALL show `.claude/` and `.cursor/` as pre-checked
- **AND** SHALL show `.opencode/` and `.agents/` as unchecked

#### Scenario: All four locations are always offered

- **WHEN** the wizard reaches the locations step
- **THEN** the multi-select SHALL include `.claude/`, `.opencode/`, `.cursor/`, and `.agents/` as choices

#### Scenario: Zero selections is rejected

- **WHEN** the user confirms the locations step with zero selections
- **THEN** the wizard SHALL display a validation error
- **AND** SHALL re-prompt without advancing

### Requirement: Wizard prompts the user to choose optional skills

The wizard SHALL present a multi-select prompt listing every skill marked `optional` in the skill catalog. All optional skills SHALL be unchecked by default. The user MAY confirm the step with zero selections, in which case only mandatory skills SHALL be installed. Mandatory skills SHALL NOT appear in this prompt and SHALL always be installed.

#### Scenario: Optional skills appear unchecked

- **WHEN** the wizard reaches the optional-skills step and the catalog contains `taskless-ci`
- **THEN** the multi-select SHALL include `taskless-ci` as an unchecked option

#### Scenario: Zero optional selections is permitted

- **WHEN** the user confirms the optional-skills step with zero selections
- **THEN** the wizard SHALL advance without error
- **AND** only mandatory skills SHALL be installed in the subsequent write step

#### Scenario: Mandatory skills are not shown

- **WHEN** the wizard renders the optional-skills step
- **THEN** skills classified as `mandatory` SHALL NOT appear in the prompt

### Requirement: Wizard explains the auth tradeoff and offers to log in

The wizard SHALL present a short informational screen describing the tradeoff between anonymous and authenticated use: authenticated rules retain conversation history across teammates, enabling rule provenance (answering "why do we have this rule?"). The screen SHALL be followed by a yes/no prompt asking the user whether they want to log in now. If the user accepts, the wizard SHALL invoke the shared interactive login routine (the same routine used by `taskless auth login`) and SHALL block until the login flow completes or is cancelled. If the user declines, the wizard SHALL print a one-line hint that they can run `taskless auth login` later and proceed to the install step. If a valid token is already present, the wizard SHALL skip this step entirely.

#### Scenario: Auth step is shown when not logged in

- **WHEN** the wizard reaches the auth step and no valid token is resolvable
- **THEN** the wizard SHALL display the tradeoff explanation
- **AND** SHALL prompt the user to log in

#### Scenario: Accepting login blocks until completion

- **WHEN** the user accepts the login prompt
- **THEN** the wizard SHALL invoke the shared interactive login routine
- **AND** SHALL NOT advance to the install step until the login routine resolves

#### Scenario: Declining login advances with a hint

- **WHEN** the user declines the login prompt
- **THEN** the wizard SHALL print a hint mentioning `taskless auth login`
- **AND** SHALL advance to the install step

#### Scenario: Auth step is skipped when already logged in

- **WHEN** the wizard reaches the auth step and a valid token already exists for the working directory
- **THEN** the wizard SHALL skip the auth explanation and prompt entirely

### Requirement: Shared interactive login routine

The CLI SHALL expose a single `loginInteractive()` function that performs the device-code login flow and returns once the token is stored or cancelled. Both the `auth login` subcommand and the wizard's auth step SHALL call this function. No duplicate login implementation SHALL exist.

#### Scenario: Auth login uses the shared routine

- **WHEN** a user runs `taskless auth login`
- **THEN** the command handler SHALL call `loginInteractive()`

#### Scenario: Wizard uses the shared routine

- **WHEN** the wizard user accepts the login prompt
- **THEN** the wizard SHALL call `loginInteractive()`

### Requirement: Wizard shows a diff-style summary before writing

Before any filesystem writes, the wizard SHALL display a summary of planned actions grouped by target location. The summary SHALL include:

- Additions: skills that will be newly written to a target
- Removals: skills previously recorded in the install manifest but not selected in the current session
- Unchanged: skills that will be overwritten with identical content (may be collapsed to a count)

If the summary contains any removals, the wizard SHALL require an explicit `confirm()` before proceeding. If the summary contains no removals, the wizard MAY proceed without an extra confirm.

#### Scenario: Additions are shown in the summary

- **WHEN** the wizard reaches the summary step and the user has selected a location that was not in the previous install manifest
- **THEN** the summary SHALL list every skill to be added under that location

#### Scenario: Removals trigger a confirm

- **WHEN** the summary contains at least one skill or location to be removed
- **THEN** the wizard SHALL display a confirm prompt before writing
- **AND** declining the confirm SHALL abort without writes

#### Scenario: No-removal summaries skip the extra confirm

- **WHEN** the summary contains only additions and unchanged entries
- **THEN** the wizard MAY proceed directly to writes without an extra confirm

### Requirement: Wizard cancellation aborts without filesystem writes

If the user cancels the wizard at any step (Ctrl-C, Esc, or equivalent clack cancel signal) before the install step completes, the CLI SHALL NOT write any skill files, command files, or manifest updates. The CLI SHALL exit with a non-zero exit code and print a short message indicating how to resume (`taskless init`).

#### Scenario: Cancel at locations step

- **WHEN** the user cancels the wizard during the locations step
- **THEN** no files SHALL be written
- **AND** the CLI SHALL exit non-zero

#### Scenario: Cancel at auth step

- **WHEN** the user cancels the wizard during the auth step
- **THEN** no skill files or manifest updates SHALL be written
- **AND** the CLI SHALL exit non-zero

#### Scenario: Cancel at summary confirm

- **WHEN** the user declines the summary confirm
- **THEN** no files SHALL be written
- **AND** the CLI SHALL exit non-zero

### Requirement: Install manifest records what was installed per target

On every successful install (wizard or `--no-interactive`), the CLI SHALL update `.taskless/taskless.json` with an `install` object keyed by target location. For each target, the CLI SHALL record the list of skill names written and the list of command filenames written. The CLI SHALL also record `installedAt` (ISO-8601 timestamp) and `cliVersion` (the `@taskless/cli` package version) at the top level of the `install` object.

#### Scenario: Manifest records skills per target

- **WHEN** `taskless init` completes writing to `.claude/` with skills `taskless-check` and `taskless-ci`
- **THEN** `taskless.json` SHALL contain `install.targets[".claude"].skills` equal to `["taskless-check", "taskless-ci"]` (order not significant)

#### Scenario: Manifest records commands for Claude Code

- **WHEN** `taskless init` completes writing command files to `.claude/commands/tskl/`
- **THEN** `taskless.json` SHALL contain `install.targets[".claude"].commands` listing each command filename written

#### Scenario: Manifest records install metadata

- **WHEN** `taskless init` completes successfully
- **THEN** `taskless.json` SHALL contain `install.installedAt` (ISO-8601 string)
- **AND** `install.cliVersion` SHALL equal the running CLI's package version

### Requirement: Re-install computes a diff against the previous manifest

On every interactive run, the wizard SHALL read the existing `install` object from `.taskless/taskless.json` (if present) and use it to compute the diff summary described in the "Wizard shows a diff-style summary" requirement. When a previously-recorded target or skill is not selected in the current session, it SHALL be classified as a removal in the summary. On confirmed writes, the CLI SHALL delete the previously-written files for each removed target or skill, then write the new manifest reflecting the current selection only.

#### Scenario: Previously installed skill not selected is removed

- **WHEN** the previous manifest recorded `.claude/skills/taskless-ci`
- **AND** the user deselects `taskless-ci` in the current wizard
- **THEN** the summary SHALL list `taskless-ci` as a removal under `.claude/`
- **AND** on confirm, `.claude/skills/taskless-ci/SKILL.md` SHALL be deleted

#### Scenario: Previously installed target not selected is removed

- **WHEN** the previous manifest recorded `.cursor/` as a target
- **AND** the user deselects `.cursor/` in the current wizard
- **THEN** the summary SHALL list every `.cursor/` skill as a removal
- **AND** on confirm, the Taskless skill files under `.cursor/skills/` SHALL be deleted

#### Scenario: Manifest only reflects current selection after write

- **WHEN** a wizard run completes writing
- **THEN** `install.targets` SHALL contain exactly the targets selected in that run
- **AND** for each target, `skills` SHALL contain exactly the skills written in that run
