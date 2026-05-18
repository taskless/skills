## ADDED Requirements

### Requirement: Skill and command content is installed once to the canonical .taskless store

The CLI SHALL write skill and command content exactly once per install, to a canonical store inside Taskless's owned `.taskless/` namespace: skill content to `.taskless/skills/<name>/SKILL.md` and command content to `.taskless/commands/tskl/<name>.md`. The canonical write SHALL occur on every install that contains at least one skill or command, regardless of which tools are selected.

The `.taskless/` canonical store SHALL NOT be a tool install target: no tool's detection, install destination, or cleanup logic SHALL point at `.taskless/skills/` or `.taskless/commands/`. This guarantees that no install target can ever delete the canonical content.

#### Scenario: Canonical content is written once

- **WHEN** `taskless init` runs and the install plan contains the `taskless` skill and `tskl` command
- **THEN** the CLI SHALL write the full skill content to `.taskless/skills/taskless/SKILL.md`
- **AND** SHALL write the full command content to `.taskless/commands/tskl/tskl.md`

#### Scenario: Canonical write happens regardless of selected tools

- **WHEN** `taskless init` runs with any combination of tool directories selected, including none
- **THEN** the canonical `.taskless/` store SHALL be written

#### Scenario: No tool target points at the canonical store

- **WHEN** the install plan is constructed and applied
- **THEN** no tool target's install or cleanup operation SHALL write to or delete `.taskless/skills/` or `.taskless/commands/`

### Requirement: Selected tool directories receive reference stubs

For every selected tool directory, the CLI SHALL write a **reference stub** rather than a full copy. Each selected directory receives its own stub — `.claude/`, `.cursor/`, `.opencode/`, and `.agents/` are peer targets, and no directory is special-cased or routed onto another. A stub SHALL be an ordinary file (never a symlink). A skill stub SHALL contain valid YAML frontmatter with `name` and `description` copied from the canonical skill so the tool can discover and trigger it, plus a `metadata` block carrying `type: shim` (which marks the file as a reference stub) and the canonical `version` (carried for reference and kept in lockstep with the canonical content). Its body SHALL instruct the agent to read the canonical file (`.taskless/skills/<name>/SKILL.md` for skills, `.taskless/commands/tskl/<name>.md` for commands) and follow it, and SHALL NOT duplicate the canonical content inline. Every stub SHALL point directly at a canonical file, never at another stub.

The CLI SHALL NOT create symlinks for any tool, for skills or commands.

The per-directory stub layout is:

- `.claude/skills/<name>/SKILL.md` and `.claude/commands/tskl/<name>.md` — Claude Code.
- `.cursor/skills/<name>/SKILL.md` and `.cursor/commands/tskl/<name>.md` — Cursor.
- `.opencode/skills/<name>/SKILL.md` — OpenCode (no command stub).
- `.agents/skills/<name>/SKILL.md` — generic Agent Skills location, including Codex (no command stub).

#### Scenario: Skill stub has valid frontmatter and a delegating body

- **WHEN** the CLI writes a skill stub for a selected directory
- **THEN** the stub SHALL be a regular file with frontmatter `name` and `description` matching the canonical skill
- **AND** the stub frontmatter SHALL include `metadata.type: shim`
- **AND** its body SHALL delegate to `.taskless/skills/<name>/SKILL.md` without inlining the canonical instructions

#### Scenario: Each selected directory gets its own stub

- **WHEN** `taskless init` runs with `.cursor/` and `.opencode/` both selected
- **THEN** a skill stub SHALL be written to `.cursor/skills/taskless/SKILL.md`
- **AND** a skill stub SHALL be written to `.opencode/skills/taskless/SKILL.md`

#### Scenario: No symlinks are created

- **WHEN** any `taskless init` or `taskless update` run completes
- **THEN** no skill or command file or directory written by the CLI SHALL be a symlink

### Requirement: Install manifest records a per-target install mode

Each target entry in `.taskless/taskless.json` install state SHALL record a `mode` field with one of two values: `canonical` (the `.taskless/` store, holding full content) or `reference` (a tool directory holding stubs). The manifest SHALL remain backward-compatible: when reading a prior manifest with no `mode` field, the CLI SHALL treat existing entries as `canonical`.

#### Scenario: Manifest records canonical and reference modes

- **WHEN** `taskless init` writes the canonical store plus tool stubs
- **THEN** the `.taskless` target entry SHALL have `mode: "canonical"`
- **AND** each selected tool directory entry SHALL have `mode: "reference"`

#### Scenario: Legacy manifest without mode is treated as canonical

- **WHEN** the CLI reads a prior manifest whose target entries omit `mode`
- **THEN** it SHALL treat each such entry as `mode: "canonical"` without error

### Requirement: Update rewrites canonical content and preserves reference stubs

`taskless update` SHALL rewrite the canonical `.taskless/skills/` and `.taskless/commands/` content from the embedded bundle. For `reference`-mode targets, update SHALL create a stub only if it is missing, and SHALL NOT overwrite an existing stub with full canonical content. Update SHALL re-generate a stub in place only when its frontmatter `name`, `description`, or `metadata.version` has drifted from the canonical content; the stub's delegating body SHALL be preserved.

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

### Requirement: Existing installs converge to the canonical-plus-stub layout

When a prior install left a full skill or command copy in a tool directory, or left a tool entry that exists on disk as a symlink, `taskless init`/`update` SHALL converge the repository onto the canonical-plus-stub layout with no separate migration step. `applyInstallPlan` SHALL seed the canonical `.taskless/` store and, for each `reference` target, SHALL rewrite the file unless it is already a current, non-drifted shim stub (a file carrying the `metadata.type: shim` marker with matching `name`, `description`, and `metadata.version`). A full copy lacks the marker and a symlink is detected by `lstat`, so each is rewritten as a real stub. Convergence SHALL be reported in the install summary.

#### Scenario: A full per-tool copy is converted to a stub

- **WHEN** a user whose prior install wrote a full `.cursor/skills/taskless/SKILL.md` runs `taskless update`
- **THEN** `.cursor/skills/taskless/SKILL.md` SHALL be replaced with a reference stub delegating to the canonical store
- **AND** the canonical `.taskless/skills/taskless/SKILL.md` SHALL be present

#### Scenario: A symlinked tool entry is replaced with a real stub

- **WHEN** `taskless update` finds `.claude/skills/taskless` recorded as a target but present on disk as a symlink
- **THEN** update SHALL replace the symlink with a real reference stub file
- **AND** SHALL NOT write through the symlink into another directory

## MODIFIED Requirements

### Requirement: Skills are installed as Agent Skills spec SKILL.md files

The CLI SHALL install skill content using a canonical-store-plus-stub model rather than writing a full copy per detected tool. The full skill content SHALL be written exactly once to the canonical `.taskless/skills/<name>/SKILL.md`. Each selected tool directory SHALL receive its own reference stub as defined by the reference-stub requirement. Skill names SHALL be installed verbatim from the embedded source. No additional namespace prefixing SHALL be applied at install time.

#### Scenario: Canonical skill content matches source

- **WHEN** a skill is installed
- **THEN** the canonical `.taskless/skills/<name>/SKILL.md` content SHALL be identical to the embedded source from `skills/`
- **AND** no frontmatter fields SHALL be modified at install time

#### Scenario: Selected tool directory receives a stub, not a full copy

- **WHEN** the CLI installs the `taskless` skill and any tool directory is selected
- **THEN** that directory's skill location SHALL contain a reference stub
- **AND** SHALL NOT contain a full copy of the canonical skill content

### Requirement: Install manifest records what was installed per target

The install manifest in `.taskless/taskless.json` continues to record what was written per target. Each target entry SHALL additionally record a `mode` field (`canonical` or `reference`) as defined by the per-target install mode requirement. The `.taskless` target records the canonical store; tool-directory targets record the stubs written for that directory.

#### Scenario: Manifest records the canonical store and reference stubs with modes

- **WHEN** init writes the canonical store and stubs for `.claude/` and `.agents/`
- **THEN** the manifest's `install.targets[".taskless"]` SHALL have `mode: "canonical"`
- **AND** `install.targets[".claude"]` and `install.targets[".agents"]` SHALL each have `mode: "reference"`

### Requirement: OpenCode detection signals

OpenCode SHALL be detected when any of the following exist in the project root:

- `.opencode/` directory
- `opencode.jsonc` file
- `opencode.json` file

When `.opencode/` is selected, a reference skill stub SHALL be installed to `.opencode/skills/<name>/SKILL.md`. OpenCode SHALL NOT receive commands.

#### Scenario: OpenCode detected by .opencode directory

- **WHEN** `.opencode/` exists as a directory in the project root
- **THEN** OpenCode SHALL be detected

#### Scenario: OpenCode detected by opencode.jsonc file

- **WHEN** `opencode.jsonc` exists as a file in the project root
- **THEN** OpenCode SHALL be detected

#### Scenario: OpenCode detected by opencode.json file

- **WHEN** `opencode.json` exists as a file in the project root
- **THEN** OpenCode SHALL be detected

#### Scenario: Selecting OpenCode writes a stub to .opencode/skills

- **WHEN** `.opencode/` is selected and `taskless init` runs
- **THEN** a reference skill stub SHALL be written to `.opencode/skills/taskless/SKILL.md`
- **AND** no command file SHALL be written under `.opencode/`

### Requirement: Cursor detection signals

Cursor SHALL be detected when any of the following exist in the project root:

- `.cursor/` directory
- `.cursorrules` file

When `.cursor/` is selected, a reference skill stub SHALL be installed to `.cursor/skills/<name>/SKILL.md` and a reference command stub to `.cursor/commands/tskl/<name>.md`.

#### Scenario: Cursor detected by .cursor directory

- **WHEN** `.cursor/` exists as a directory in the project root
- **THEN** Cursor SHALL be detected

#### Scenario: Cursor detected by .cursorrules file

- **WHEN** `.cursorrules` exists as a file in the project root
- **THEN** Cursor SHALL be detected

#### Scenario: Selecting Cursor writes a skill stub and a command stub

- **WHEN** `.cursor/` is selected and `taskless init` runs
- **THEN** a reference skill stub SHALL be written to `.cursor/skills/taskless/SKILL.md`
- **AND** a reference command stub SHALL be written to `.cursor/commands/tskl/`

### Requirement: Claude Code detection signals

Claude Code SHALL be detected when any of the following exist in the project root:

- `.claude/` directory
- `CLAUDE.md` file

When `.claude/` is selected, a reference skill stub SHALL be installed to `.claude/skills/<name>/SKILL.md` and a reference command stub to `.claude/commands/tskl/<name>.md`.

#### Scenario: Claude Code detected by .claude directory

- **WHEN** `.claude/` exists as a directory in the project root
- **THEN** Claude Code SHALL be detected
- **AND** a reference skill stub SHALL be installed to `.claude/skills/`

#### Scenario: Claude Code detected by CLAUDE.md file

- **WHEN** `CLAUDE.md` exists as a file in the project root
- **AND** `.claude/` directory does not exist
- **THEN** Claude Code SHALL be detected
- **AND** a reference skill stub SHALL be installed to `.claude/skills/`

### Requirement: Agents fallback install

`.agents/` is an ordinary selectable tool target, a peer of `.claude/`, `.cursor/`, and `.opencode/`. When `.agents/` is selected, a reference skill stub SHALL be installed to `.agents/skills/<name>/SKILL.md`. The `.agents/` target SHALL NOT receive commands. When no tools are detected, `.agents/` SHALL be the default selected target so a `taskless init` with zero detected tools still produces a usable install.

#### Scenario: .agents stub written when no tools detected

- **WHEN** a user runs `taskless init`
- **AND** no tools are detected in the project root
- **THEN** `.agents/` SHALL be selected by default
- **AND** a reference skill stub SHALL be installed to `.agents/skills/`

#### Scenario: .agents target does not install commands

- **WHEN** the `.agents/skills/` stub is written
- **THEN** no command files SHALL be written to `.agents/`

### Requirement: Claude Code commands are placed from embedded source

For Claude Code, the CLI SHALL place a reference command stub at `.claude/commands/tskl/<name>.md`. The stub SHALL delegate to the canonical command at `.taskless/commands/tskl/<name>.md` and SHALL NOT inline the command content.

#### Scenario: Command stub is placed for Claude Code

- **WHEN** the CLI installs for Claude Code
- **THEN** it SHALL write a command stub to `.claude/commands/tskl/<name>.md`
- **AND** the stub SHALL delegate to `.taskless/commands/tskl/<name>.md`

#### Scenario: Command stubs are only placed for tools that support commands

- **WHEN** the CLI installs for a tool directory that does not support commands (`.opencode/`, `.agents/`)
- **THEN** no command file SHALL be written for that directory

### Requirement: Cursor commands are placed from embedded source

For Cursor, the CLI SHALL place a reference command stub at `.cursor/commands/tskl/<name>.md`, mirroring the layout used for Claude Code. The stub SHALL delegate to the canonical command at `.taskless/commands/tskl/<name>.md` and SHALL NOT inline the command content.

#### Scenario: Command stub is placed for Cursor

- **WHEN** the CLI installs for Cursor
- **THEN** it SHALL write a command stub to `.cursor/commands/tskl/<name>.md`
- **AND** the stub SHALL delegate to `.taskless/commands/tskl/<name>.md`

#### Scenario: Cursor receives a skill stub and a command stub

- **WHEN** `.cursor/` is selected and the install plan is applied
- **THEN** a skill stub SHALL be written to `.cursor/skills/`
- **AND** a command stub SHALL be written to `.cursor/commands/tskl/`

### Requirement: Wizard prompts the user to choose install locations

The wizard's location step SHALL be presented as a tool-selection step: "which tools do you want to enable Taskless for?". It SHALL offer a fixed multiselect of `.claude/`, `.cursor/`, `.opencode/`, and `.agents/`, with detected directories pre-checked and `.agents/` pre-checked when no tools are detected. The canonical `.taskless/` store SHALL NOT appear as a selectable entry — it is always written. Each checked entry SHALL produce one `reference` stub target; the resulting install plan always contains the single `taskless` skill (and, for `.claude/` and `.cursor/`, the `tskl` command).

#### Scenario: Detected tools are pre-checked

- **WHEN** the wizard reaches the tool-selection step and `.claude/` is detected
- **THEN** `.claude/` SHALL be pre-checked in the multiselect

#### Scenario: Agents is the default when nothing is detected

- **WHEN** the wizard reaches the tool-selection step and no tools are detected
- **THEN** `.agents/` SHALL be pre-checked

#### Scenario: Canonical store is not a selectable entry

- **WHEN** the wizard renders the tool-selection multiselect
- **THEN** `.taskless/` SHALL NOT appear as a selectable option
