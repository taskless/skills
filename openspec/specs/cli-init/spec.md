# CLI Init

## Purpose

TBD — Defines the `taskless init` subcommand that installs Taskless skills into a repository by detecting AI tools and writing skill files.

## Requirements

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

Skills SHALL be installed to `.cursor/skills/<name>/SKILL.md`. Commands SHALL be installed to `.cursor/commands/tskl/<name>.md`.

#### Scenario: Cursor detected by .cursor directory

- **WHEN** `.cursor/` exists as a directory in the project root
- **THEN** Cursor SHALL be detected

#### Scenario: Cursor detected by .cursorrules file

- **WHEN** `.cursorrules` exists as a file in the project root
- **THEN** Cursor SHALL be detected

### Requirement: Codex detection signals

OpenAI Codex SHALL be detected when any of the following exist in the project root:

- `.codex/` directory
- `.codex/config.toml` file

Skills SHALL be installed to `.agents/skills/<name>/SKILL.md` (Codex's documented read path). Codex SHALL NOT receive commands — Codex's custom slash commands are deprecated upstream and the official replacement is skills.

#### Scenario: Codex detected by .codex directory

- **WHEN** `.codex/` exists as a directory in the project root
- **THEN** Codex SHALL be detected
- **AND** skills SHALL be installed to `.agents/skills/`

#### Scenario: Codex detected by .codex/config.toml file

- **WHEN** `.codex/config.toml` exists as a file in the project root
- **THEN** Codex SHALL be detected
- **AND** skills SHALL be installed to `.agents/skills/`

#### Scenario: Codex detected alongside other tools

- **WHEN** `.codex/` exists and `.claude/` exists in the project root
- **THEN** both Codex and Claude Code SHALL be detected
- **AND** skills SHALL be installed to `.agents/skills/` for Codex
- **AND** skills SHALL be installed to `.claude/skills/` for Claude Code

#### Scenario: Codex does not receive commands

- **WHEN** Codex is detected and the install plan is built
- **THEN** no command files SHALL be written for Codex

### Requirement: Codex install destination overrides the fallback for the same directory

When Codex is detected, the install plan SHALL treat `.agents/` as the Codex target rather than the generic agents fallback. The state-based cleanup helper that resolves a tool descriptor by `installDir` SHALL prefer registered tool entries (including Codex) over the `AGENTS_FALLBACK` descriptor when both share the same `installDir` value. The user-facing install summary SHALL name "Codex" as the target for `.agents/skills/` writes when `.codex/` is present, instead of the generic fallback labeling.

#### Scenario: Codex detection labels the .agents/ install as Codex

- **WHEN** `.codex/` is present and `taskless init` runs
- **THEN** the install summary SHALL identify the `.agents/skills/` writes as belonging to Codex
- **AND** SHALL NOT use the "no tools detected, installing fallback" wording

#### Scenario: Lookup by installDir resolves to Codex over fallback

- **WHEN** the state-based cleanup helper looks up a tool descriptor by `installDir = ".agents"`
- **AND** Codex is registered in the tool array
- **THEN** the lookup SHALL return the Codex descriptor, not `AGENTS_FALLBACK`

#### Scenario: Fallback still resolvable for legacy state without Codex detection

- **WHEN** a previous install state recorded `.agents/` as the target
- **AND** `.codex/` does not exist in the working directory
- **AND** no other tools are detected
- **THEN** the install SHALL proceed using the fallback path
- **AND** files SHALL still be written to `.agents/skills/`

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

### Requirement: Cursor commands are placed from embedded source

For Cursor specifically, the CLI SHALL also place command `.md` files from the embedded command source. Commands SHALL be placed in `.cursor/commands/tskl/` with filenames matching the embedded source (prefix already stripped), mirroring the layout used for Claude Code.

#### Scenario: Command file is placed from embedded source

- **WHEN** the CLI installs for Cursor
- **THEN** it SHALL write command files to `.cursor/commands/tskl/<name>.md`
- **AND** the command content SHALL be identical to the embedded source from `commands/tskl/`

#### Scenario: Cursor receives both skills and commands

- **WHEN** Cursor is detected and the install plan is applied
- **THEN** skills SHALL be written to `.cursor/skills/`
- **AND** commands SHALL be written to `.cursor/commands/tskl/`

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

### Requirement: Wizard renders an intro banner

The wizard SHALL begin by rendering an ASCII rendition of the Taskless wordmark followed by the CLI version, styled with `chalk` for color output. The banner SHALL downgrade gracefully when colors are disabled (e.g., `NO_COLOR=1` or non-TTY). The exact ASCII art is not fixed by this requirement and MAY be iterated in follow-up changes.

#### Scenario: Wizard prints a banner on start

- **WHEN** the wizard starts
- **THEN** an ASCII banner SHALL be written to stderr before any prompts

#### Scenario: Banner honors NO_COLOR

- **WHEN** `NO_COLOR=1` is set in the environment
- **THEN** the banner SHALL be rendered without ANSI color escapes

### Requirement: Wizard prompts the user to choose install locations

The wizard's location step is unchanged in shape but the resulting install plan only ever contains the single `taskless` skill (and its corresponding `tskl` command).

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
