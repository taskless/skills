# CLI Init

## Purpose

TBD — Defines the `taskless init` subcommand that installs Taskless skills into a repository by detecting AI tools and writing skill files.

## Requirements

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

### Requirement: Tool detection via filesystem inspection

The CLI SHALL detect installed AI tools by checking for known detection signals (files and directories) via parallel filesystem checks. Detection SHALL NOT rely on parsing configuration file contents or other tool-specific metadata; config-style files MAY be used only as file-presence signals. The tool registry SHALL be a typed array of tool descriptors maintained in `packages/cli/src/install/install.ts`. Each tool descriptor SHALL have a `detect` array of signals and a separate `installDir` for the install root.

#### Scenario: Claude Code is detected

- **WHEN** a `.claude/` directory or `CLAUDE.md` file exists in the working directory
- **THEN** the CLI SHALL detect Claude Code as an installed tool

#### Scenario: OpenCode is detected

- **WHEN** a `.opencode/` directory, `opencode.jsonc` file, or `opencode.json` file exists in the working directory
- **THEN** the CLI SHALL detect OpenCode as an installed tool

#### Scenario: Cursor is detected

- **WHEN** a `.cursor/` directory or `.cursorrules` file exists in the working directory
- **THEN** the CLI SHALL detect Cursor as an installed tool

#### Scenario: Multiple tools are detected

- **WHEN** multiple known tool signals exist (e.g., `.claude/` and `.cursor/`)
- **THEN** the CLI SHALL detect all of them and install skills for each

#### Scenario: No tools detected triggers fallback

- **WHEN** no known tool signals exist in the working directory
- **THEN** the CLI SHALL install skills to `.agents/skills/` as a fallback

### Requirement: Tool descriptor separates detection from install path

Each tool in the registry SHALL have a `detect` array of signals and a separate `installDir` string. Detection signals SHALL be objects with a `type` field (`"directory"` or `"file"`) and a `path` field relative to the project root.

#### Scenario: Tool detected by directory signal

- **WHEN** a tool descriptor has `{ type: "directory", path: ".claude" }` in its `detect` array
- **AND** `.claude/` exists as a directory in the project root
- **THEN** the tool SHALL be detected

#### Scenario: Tool detected by file signal

- **WHEN** a tool descriptor has `{ type: "file", path: "CLAUDE.md" }` in its `detect` array
- **AND** `CLAUDE.md` exists as a file in the project root
- **THEN** the tool SHALL be detected

#### Scenario: Tool detected by any matching signal

- **WHEN** a tool descriptor has multiple signals in its `detect` array
- **AND** at least one signal matches a file or directory in the project root
- **THEN** the tool SHALL be detected

#### Scenario: Tool not detected when no signals match

- **WHEN** no signals in a tool's `detect` array match files or directories in the project root
- **THEN** the tool SHALL NOT be detected

### Requirement: Claude Code detection signals

Claude Code SHALL be detected when any of the following exist in the project root:

- `.claude/` directory
- `CLAUDE.md` file

Skills SHALL be installed to `.claude/skills/<name>/SKILL.md`. Commands SHALL be installed to `.claude/commands/tskl/`.

#### Scenario: Claude Code detected by .claude directory

- **WHEN** `.claude/` exists as a directory in the project root
- **THEN** Claude Code SHALL be detected
- **AND** skills SHALL be installed to `.claude/skills/`

#### Scenario: Claude Code detected by CLAUDE.md file

- **WHEN** `CLAUDE.md` exists as a file in the project root
- **AND** `.claude/` directory does not exist
- **THEN** Claude Code SHALL be detected
- **AND** skills SHALL be installed to `.claude/skills/`

### Requirement: OpenCode detection signals

OpenCode SHALL be detected when any of the following exist in the project root:

- `.opencode/` directory
- `opencode.jsonc` file
- `opencode.json` file

Skills SHALL be installed to `.opencode/skills/<name>/SKILL.md`. OpenCode SHALL NOT receive commands.

#### Scenario: OpenCode detected by .opencode directory

- **WHEN** `.opencode/` exists as a directory in the project root
- **THEN** OpenCode SHALL be detected

#### Scenario: OpenCode detected by opencode.jsonc file

- **WHEN** `opencode.jsonc` exists as a file in the project root
- **THEN** OpenCode SHALL be detected

#### Scenario: OpenCode detected by opencode.json file

- **WHEN** `opencode.json` exists as a file in the project root
- **THEN** OpenCode SHALL be detected

### Requirement: Cursor detection signals

Cursor SHALL be detected when any of the following exist in the project root:

- `.cursor/` directory
- `.cursorrules` file

Skills SHALL be installed to `.cursor/skills/<name>/SKILL.md`. Cursor SHALL NOT receive commands.

#### Scenario: Cursor detected by .cursor directory

- **WHEN** `.cursor/` exists as a directory in the project root
- **THEN** Cursor SHALL be detected

#### Scenario: Cursor detected by .cursorrules file

- **WHEN** `.cursorrules` exists as a file in the project root
- **THEN** Cursor SHALL be detected

### Requirement: Agents fallback install

When `taskless init` completes with zero tool installs (no tools were detected), skills SHALL be installed to `.agents/skills/<name>/SKILL.md`. The `.agents/` target SHALL NOT receive commands. The `.agents/` target SHALL NOT be part of tool detection — it is used only as a fallback.

#### Scenario: Fallback installs to .agents when no tools detected

- **WHEN** a user runs `taskless init`
- **AND** no tools are detected in the project root
- **THEN** skills SHALL be installed to `.agents/skills/`

#### Scenario: Fallback not used when tools are detected

- **WHEN** a user runs `taskless init`
- **AND** at least one tool is detected
- **THEN** skills SHALL NOT be installed to `.agents/skills/`

#### Scenario: Fallback does not install commands

- **WHEN** the `.agents/` fallback is used
- **THEN** no command files SHALL be written

### Requirement: Detection checks files and directories with stat

Directory detection signals SHALL use `fs.stat()` and verify `isDirectory()`. File detection signals SHALL use `fs.stat()` and verify `isFile()` to avoid false positives on directories. All detection checks SHALL run in parallel.

#### Scenario: Directory signal uses stat

- **WHEN** a directory detection signal is evaluated
- **THEN** `fs.stat()` SHALL be called on the path
- **AND** `isDirectory()` SHALL return true for detection to succeed

#### Scenario: File signal uses stat

- **WHEN** a file detection signal is evaluated
- **THEN** `fs.stat()` SHALL be called on the path
- **AND** `isFile()` SHALL return true for detection to succeed

#### Scenario: Detection runs in parallel

- **WHEN** `detectTools()` is called
- **THEN** all tool detection checks SHALL run concurrently via `Promise.all`

### Requirement: Skills are installed as Agent Skills spec SKILL.md files

For each detected tool that supports skills, the CLI SHALL write SKILL.md files into the tool's skill directory. Skill names SHALL be installed verbatim from the embedded source (already prefixed with `taskless-`). No additional namespace prefixing SHALL be applied at install time.

#### Scenario: Skill installed with verbatim name

- **WHEN** the CLI installs the `taskless-info` skill for Claude Code
- **THEN** it SHALL write to `.claude/skills/taskless-info/SKILL.md`
- **AND** the `name` field in the SKILL.md frontmatter SHALL be `taskless-info`

#### Scenario: Skill content matches source

- **WHEN** a skill is installed
- **THEN** the SKILL.md content SHALL be identical to the embedded source from `skills/`
- **AND** no frontmatter fields SHALL be modified at install time

### Requirement: Claude Code commands are placed from embedded source

For Claude Code specifically, the CLI SHALL also place command `.md` files from the embedded command source. Commands SHALL be placed in `.claude/commands/taskless/` with filenames matching the embedded source (prefix already stripped).

#### Scenario: Command file is placed from embedded source

- **WHEN** the CLI installs for Claude Code
- **THEN** it SHALL write command files to `.claude/commands/taskless/<name>.md`
- **AND** the command content SHALL be identical to the embedded source from `commands/taskless/`

#### Scenario: Command files are only placed for Claude Code

- **WHEN** the CLI installs for a tool that does not support commands
- **THEN** no command files SHALL be written for that tool

### Requirement: Skills are bundled into the CLI at build time

The CLI build SHALL embed all skill file content from `skills/` and all command file content from `commands/taskless/` into the compiled bundle using Vite's `import.meta.glob` with raw file imports. No runtime file reads or network fetches SHALL be used to access skill or command content.

#### Scenario: Embedded skills are available at runtime

- **WHEN** the CLI runs `taskless init`
- **THEN** it SHALL access skill content from the embedded bundle without reading the filesystem or making network requests

#### Scenario: Embedded commands are available at runtime

- **WHEN** the CLI runs `taskless init` for Claude Code
- **THEN** it SHALL access command content from the embedded bundle without reading the filesystem

#### Scenario: Build includes all skills from source directory

- **WHEN** `pnpm build` is run in `packages/cli/`
- **THEN** every `SKILL.md` file under `skills/` SHALL be embedded in the output bundle

#### Scenario: Build includes all commands from source directory

- **WHEN** `pnpm build` is run in `packages/cli/`
- **THEN** every `.md` file under `commands/taskless/` SHALL be embedded in the output bundle

### Requirement: Init respects the global working directory flag

The `init` subcommand SHALL use the resolved working directory from the global `-d` flag (or `process.cwd()` if not specified) as the target directory for tool detection and skill installation.

#### Scenario: Init uses custom directory

- **WHEN** a user runs `taskless init -d /path/to/repo`
- **THEN** tool detection and skill installation SHALL operate on `/path/to/repo`

#### Scenario: Init defaults to current directory

- **WHEN** a user runs `taskless init` without `-d`
- **THEN** tool detection and skill installation SHALL operate on `process.cwd()`

### Requirement: Init installs anonymous skill variants

The `taskless init` subcommand SHALL install the `taskless-create-rule-anonymous` and `taskless-improve-rule-anonymous` skills alongside existing skills. These skills SHALL be bundled into the CLI at build time using the same `import.meta.glob` pattern as existing skills.

#### Scenario: Anonymous skills are installed for Claude Code

- **WHEN** a user runs `taskless init` in a repository with a `.claude/` directory
- **THEN** the CLI SHALL write `taskless-create-rule-anonymous/SKILL.md` and `taskless-improve-rule-anonymous/SKILL.md` to `.claude/skills/`

#### Scenario: Anonymous skills have no command files

- **WHEN** the CLI installs skills and commands
- **THEN** no command `.md` files SHALL be created for the anonymous skill variants

#### Scenario: Build includes anonymous skills

- **WHEN** `pnpm build` is run in `packages/cli/`
- **THEN** the `taskless-create-rule-anonymous` and `taskless-improve-rule-anonymous` SKILL.md files SHALL be embedded in the output bundle

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

The wizard SHALL begin by rendering an ASCII rendition of the Taskless wordmark followed by the CLI version, styled with `chalk` for color output. The banner SHALL downgrade gracefully when colors are disabled (e.g., `NO_COLOR=1` or non-TTY). The exact ASCII art is not fixed by this requirement and MAY be iterated in follow-up changes.

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
