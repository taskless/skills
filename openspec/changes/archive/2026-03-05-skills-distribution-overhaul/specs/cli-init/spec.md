# CLI Init

## MODIFIED Requirements

### Requirement: Init subcommand installs skills into a repository

The CLI SHALL support a `taskless init` subcommand that installs Taskless skills into the current working directory. The subcommand SHALL also be available as `taskless update` (alias with identical behavior). When no tool directories are detected, the CLI SHALL inform the user and suggest using the Claude Code Plugin Marketplace or Vercel skills CLI as alternatives.

#### Scenario: Running taskless init installs skills

- **WHEN** a user runs `taskless init` in a repository with at least one detected AI tool directory
- **THEN** the CLI SHALL write skill files into each detected tool's directory
- **AND** report which tools were updated and how many skills were installed

#### Scenario: Running taskless update behaves identically to init

- **WHEN** a user runs `taskless update`
- **THEN** the behavior SHALL be identical to `taskless init`

#### Scenario: Running init with no detected tools shows alternatives

- **WHEN** a user runs `taskless init` in a repository with no detected AI tool directories
- **THEN** the CLI SHALL inform the user that no supported tool directories were found
- **AND** suggest using the Claude Code Plugin Marketplace or Vercel skills CLI for installation

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

## REMOVED Requirements

### Requirement: AGENTS.md fallback uses comment region markers

**Reason**: AGENTS.md generation is replaced by suggesting marketplace or Vercel skills CLI alternatives when no tools are detected.

**Migration**: Users who relied on AGENTS.md should use `taskless init` with a supported tool directory, the Claude Code Plugin Marketplace, or the Vercel skills CLI.

### Requirement: Claude Code commands are derived from skills

**Reason**: Commands are no longer derived at install time. They are pre-generated via `scripts/generate-commands.ts`, checked into the repo at `commands/taskless/`, and embedded in the CLI for placement.

**Migration**: Commands are now placed verbatim from embedded source rather than derived from skills at runtime.
