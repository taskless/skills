## ADDED Requirements

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

## MODIFIED Requirements

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
