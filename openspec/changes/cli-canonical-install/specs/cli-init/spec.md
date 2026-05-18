## ADDED Requirements

### Requirement: Skill and command content is installed once to the canonical .taskless store

The CLI SHALL write skill and command content exactly once per install, to a canonical store inside Taskless's owned `.taskless/` namespace: skill content to `.taskless/skills/<name>/SKILL.md` and command content to `.taskless/commands/tskl/<name>.md`. The canonical write SHALL occur on every install that contains at least one skill or command, regardless of how many tools are detected.

The `.taskless/` canonical store SHALL NOT be a tool install target: no tool's detection, install destination, or cleanup logic SHALL point at `.taskless/skills/` or `.taskless/commands/`. This guarantees that no install target can ever delete the canonical content.

#### Scenario: Canonical content is written once

- **WHEN** `taskless init` runs and the install plan contains the `taskless` skill and `tskl` command
- **THEN** the CLI SHALL write the full skill content to `.taskless/skills/taskless/SKILL.md`
- **AND** SHALL write the full command content to `.taskless/commands/tskl/tskl.md`

#### Scenario: Canonical write happens regardless of detected tools

- **WHEN** `taskless init` runs with any combination of tools detected, including none
- **THEN** the canonical `.taskless/` store SHALL be written

#### Scenario: No tool target points at the canonical store

- **WHEN** the install plan is constructed and applied
- **THEN** no tool target's install or cleanup operation SHALL write to or delete `.taskless/skills/` or `.taskless/commands/`

### Requirement: Tool locations receive reference stubs that delegate to the canonical store

For every tool location that needs the skill or command, the CLI SHALL write a **reference stub** rather than a full copy. A stub SHALL be an ordinary file (never a symlink). A skill stub SHALL contain valid YAML frontmatter with `name` and `description` copied from the canonical skill so the tool can discover and trigger it; its body SHALL instruct the agent to read the canonical file (`.taskless/skills/<name>/SKILL.md` for skills, `.taskless/commands/tskl/<name>.md` for commands) and follow it, and SHALL NOT duplicate the canonical content inline. Every stub SHALL point directly at a canonical file, never at another stub.

The CLI SHALL NOT create symlinks for any tool, for skills or commands.

The stub locations are:

- `.claude/skills/<name>/SKILL.md` — skill stub for Claude Code.
- `.agents/skills/<name>/SKILL.md` — skill stub serving OpenCode, Cursor, and Codex, which read `.agents/skills/` natively.
- `.claude/commands/tskl/<name>.md` and `.cursor/commands/tskl/<name>.md` — command stubs.

#### Scenario: Skill stub has valid frontmatter and a delegating body

- **WHEN** the CLI writes a skill stub for a tool
- **THEN** the stub SHALL be a regular file with frontmatter `name` and `description` matching the canonical skill
- **AND** its body SHALL delegate to `.taskless/skills/<name>/SKILL.md` without inlining the canonical instructions

#### Scenario: One .agents stub serves the .agents-native tools

- **WHEN** any of OpenCode, Cursor, or Codex is detected and `taskless init` runs
- **THEN** the CLI SHALL write a single skill stub at `.agents/skills/<name>/SKILL.md`
- **AND** SHALL NOT write a skill file under `.opencode/skills/` or `.cursor/skills/`

#### Scenario: No symlinks are created

- **WHEN** any `taskless init` or `taskless update` run completes
- **THEN** no skill or command file or directory written by the CLI SHALL be a symlink

### Requirement: Install manifest records a per-target install mode

Each target entry in `.taskless/taskless.json` install state SHALL record a `mode` field with one of two values: `canonical` (the `.taskless/` store, holding full content) or `reference` (a tool location holding stubs). The manifest SHALL remain backward-compatible: when reading a prior manifest with no `mode` field, the CLI SHALL treat existing entries as `canonical`.

#### Scenario: Manifest records canonical and reference modes

- **WHEN** `taskless init` writes the canonical store plus tool stubs
- **THEN** the `.taskless` target entry SHALL have `mode: "canonical"`
- **AND** each tool location entry (e.g. `.claude`, `.agents`) SHALL have `mode: "reference"`

#### Scenario: Legacy manifest without mode is treated as canonical

- **WHEN** the CLI reads a prior manifest whose target entries omit `mode`
- **THEN** it SHALL treat each such entry as `mode: "canonical"` without error

### Requirement: Update rewrites canonical content and preserves reference stubs

`taskless update` SHALL rewrite the canonical `.taskless/skills/` and `.taskless/commands/` content from the embedded bundle. For `reference`-mode targets, update SHALL create a stub only if it is missing, and SHALL NOT overwrite an existing stub with full canonical content. Update SHALL re-generate a stub in place only when its frontmatter `name`/`description` has drifted from the canonical content; the stub's delegating body SHALL be preserved.

Update SHALL NOT delete or `rm -rf` the canonical `.taskless/` store, nor any directory that another target sources content from. Removal logic SHALL operate only on entries recorded in the prior manifest and SHALL respect each entry's `mode`.

#### Scenario: Update refreshes canonical content

- **WHEN** `taskless update` runs against an install with a newer bundled skill version
- **THEN** `.taskless/skills/taskless/SKILL.md` SHALL be rewritten with the new content

#### Scenario: Update does not clobber a reference stub

- **WHEN** `taskless update` runs and `.claude/skills/taskless/SKILL.md` is an existing reference stub
- **THEN** update SHALL NOT replace it with full canonical content
- **AND** the stub SHALL continue to delegate to `.taskless/skills/taskless/SKILL.md`

#### Scenario: Update never destroys the canonical store

- **WHEN** `taskless update` processes its targets
- **THEN** it SHALL NOT delete `.taskless/skills/` or `.taskless/commands/` as part of cleaning up any target
- **AND** the canonical content SHALL remain readable throughout the update

### Requirement: Obsolete per-tool copies and symlinks are converged on update

When a prior install recorded full skill copies under tool-specific skill directories that the new model no longer writes (`.cursor/skills/`, `.opencode/skills/`), or recorded a tool entry that exists on disk as a symlink, `taskless update` SHALL converge the repository onto the canonical-plus-stub layout: obsolete full copies SHALL be removed, and any symlinked tool entry SHALL be replaced with a real reference stub file. Removal SHALL be driven by recorded manifest state, not by glob-deletion of arbitrary paths, and SHALL be reported in the install summary.

#### Scenario: Upgrading a multi-copy install converges on canonical

- **WHEN** a user whose prior install wrote `.cursor/skills/taskless/SKILL.md` and `.opencode/skills/taskless/SKILL.md` runs `taskless update`
- **THEN** those obsolete skill copies SHALL be removed
- **AND** the canonical `.taskless/skills/taskless/SKILL.md` SHALL be present
- **AND** the install summary SHALL report the removed obsolete copies

#### Scenario: A symlinked tool entry is replaced with a real stub

- **WHEN** `taskless update` finds `.claude/skills/taskless` recorded as a target but present on disk as a symlink
- **THEN** update SHALL replace the symlink with a real reference stub file
- **AND** SHALL NOT write through the symlink into another directory

## MODIFIED Requirements

### Requirement: Skills are installed as Agent Skills spec SKILL.md files

The CLI SHALL install skill content using a canonical-store-plus-stub model rather than writing a full copy per detected tool. The full skill content SHALL be written exactly once to the canonical `.taskless/skills/<name>/SKILL.md`. Each tool location that needs the skill SHALL receive a reference stub as defined by the reference-stub requirement. Skill names SHALL be installed verbatim from the embedded source. No additional namespace prefixing SHALL be applied at install time.

#### Scenario: Canonical skill content matches source

- **WHEN** a skill is installed
- **THEN** the canonical `.taskless/skills/<name>/SKILL.md` content SHALL be identical to the embedded source from `skills/`
- **AND** no frontmatter fields SHALL be modified at install time

#### Scenario: Detected tool receives a stub, not a full copy

- **WHEN** the CLI installs the `taskless` skill and any tool is detected
- **THEN** the tool's skill location SHALL contain a reference stub
- **AND** SHALL NOT contain a full copy of the canonical skill content

### Requirement: Install manifest records what was installed per target

The install manifest in `.taskless/taskless.json` continues to record what was written per target. Each target entry SHALL additionally record a `mode` field (`canonical` or `reference`) as defined by the per-target install mode requirement. The `.taskless` target records the canonical store; tool-location targets record the stubs written for that tool.

#### Scenario: Manifest records the canonical store and reference stubs with modes

- **WHEN** init writes the canonical store and stubs for Claude Code and the `.agents/` location
- **THEN** the manifest's `install.targets[".taskless"]` SHALL have `mode: "canonical"`
- **AND** `install.targets[".claude"]` and `install.targets[".agents"]` SHALL each have `mode: "reference"`

### Requirement: OpenCode detection signals

OpenCode SHALL be detected when any of the following exist in the project root:

- `.opencode/` directory
- `opencode.jsonc` file
- `opencode.json` file

OpenCode reads `.agents/skills/<name>/SKILL.md` natively, so detecting OpenCode SHALL ensure a skill stub exists at `.agents/skills/`; the CLI SHALL NOT write a skill file under `.opencode/skills/`. OpenCode SHALL NOT receive commands.

#### Scenario: OpenCode detected by .opencode directory

- **WHEN** `.opencode/` exists as a directory in the project root
- **THEN** OpenCode SHALL be detected

#### Scenario: OpenCode detected by opencode.jsonc file

- **WHEN** `opencode.jsonc` exists as a file in the project root
- **THEN** OpenCode SHALL be detected

#### Scenario: OpenCode detected by opencode.json file

- **WHEN** `opencode.json` exists as a file in the project root
- **THEN** OpenCode SHALL be detected

#### Scenario: Detecting OpenCode writes only the .agents stub

- **WHEN** OpenCode is detected and `taskless init` runs
- **THEN** a skill stub SHALL exist at `.agents/skills/taskless/SKILL.md`
- **AND** no skill file SHALL be written under `.opencode/skills/`

### Requirement: Cursor detection signals

Cursor SHALL be detected when any of the following exist in the project root:

- `.cursor/` directory
- `.cursorrules` file

Cursor reads `.agents/skills/<name>/SKILL.md` natively, so detecting Cursor SHALL ensure a skill stub exists at `.agents/skills/`; the CLI SHALL NOT write a skill file under `.cursor/skills/`. Cursor SHALL receive a command stub at `.cursor/commands/tskl/<name>.md`.

#### Scenario: Cursor detected by .cursor directory

- **WHEN** `.cursor/` exists as a directory in the project root
- **THEN** Cursor SHALL be detected

#### Scenario: Cursor detected by .cursorrules file

- **WHEN** `.cursorrules` exists as a file in the project root
- **THEN** Cursor SHALL be detected

#### Scenario: Detecting Cursor writes the .agents skill stub and a Cursor command stub

- **WHEN** Cursor is detected and `taskless init` runs
- **THEN** a skill stub SHALL exist at `.agents/skills/taskless/SKILL.md`
- **AND** no skill file SHALL be written under `.cursor/skills/`
- **AND** a command stub SHALL be written to `.cursor/commands/tskl/`

### Requirement: Claude Code detection signals

Claude Code SHALL be detected when any of the following exist in the project root:

- `.claude/` directory
- `CLAUDE.md` file

When Claude Code is detected, a reference skill stub SHALL be installed to `.claude/skills/<name>/SKILL.md` and a reference command stub SHALL be installed to `.claude/commands/tskl/<name>.md`.

#### Scenario: Claude Code detected by .claude directory

- **WHEN** `.claude/` exists as a directory in the project root
- **THEN** Claude Code SHALL be detected
- **AND** a skill stub SHALL be installed to `.claude/skills/`

#### Scenario: Claude Code detected by CLAUDE.md file

- **WHEN** `CLAUDE.md` exists as a file in the project root
- **AND** `.claude/` directory does not exist
- **THEN** Claude Code SHALL be detected
- **AND** a skill stub SHALL be installed to `.claude/skills/`

### Requirement: Agents fallback install

`.agents/skills/<name>/SKILL.md` SHALL hold a reference skill stub whenever any of OpenCode, Cursor, or Codex is detected, or when no tools are detected at all (the fallback case). The `.agents/` location SHALL always hold a stub — never full canonical content — and SHALL NOT receive commands. The `.agents/` target SHALL NOT be part of tool detection.

#### Scenario: .agents stub written when no tools detected

- **WHEN** a user runs `taskless init`
- **AND** no tools are detected in the project root
- **THEN** a skill stub SHALL be installed to `.agents/skills/`

#### Scenario: .agents location never holds full content

- **WHEN** the `.agents/skills/` stub is written
- **THEN** it SHALL be a reference stub delegating to `.taskless/skills/`
- **AND** SHALL NOT contain full canonical skill content

#### Scenario: .agents location does not install commands

- **WHEN** the `.agents/skills/` stub is written
- **THEN** no command files SHALL be written to `.agents/`

### Requirement: Claude Code commands are placed from embedded source

For Claude Code, the CLI SHALL place a reference command stub at `.claude/commands/tskl/<name>.md`. The stub SHALL delegate to the canonical command at `.taskless/commands/tskl/<name>.md` and SHALL NOT inline the command content.

#### Scenario: Command stub is placed for Claude Code

- **WHEN** the CLI installs for Claude Code
- **THEN** it SHALL write a command stub to `.claude/commands/tskl/<name>.md`
- **AND** the stub SHALL delegate to `.taskless/commands/tskl/<name>.md`

#### Scenario: Command stubs are only placed for tools that support commands

- **WHEN** the CLI installs for a tool that does not support commands
- **THEN** no command file SHALL be written for that tool

### Requirement: Cursor commands are placed from embedded source

For Cursor, the CLI SHALL place a reference command stub at `.cursor/commands/tskl/<name>.md`, mirroring the layout used for Claude Code. The stub SHALL delegate to the canonical command at `.taskless/commands/tskl/<name>.md` and SHALL NOT inline the command content.

#### Scenario: Command stub is placed for Cursor

- **WHEN** the CLI installs for Cursor
- **THEN** it SHALL write a command stub to `.cursor/commands/tskl/<name>.md`
- **AND** the stub SHALL delegate to `.taskless/commands/tskl/<name>.md`

#### Scenario: Cursor receives a skill stub and a command stub

- **WHEN** Cursor is detected and the install plan is applied
- **THEN** a skill stub SHALL serve Cursor via `.agents/skills/`
- **AND** a command stub SHALL be written to `.cursor/commands/tskl/`
