# CLI Init

## Purpose

TBD — Defines the `taskless init` subcommand that installs Taskless skills into a repository by detecting AI tools and writing skill files.

## Requirements

### Requirement: Init subcommand installs skills into a repository

The CLI SHALL support a `taskless init` subcommand that installs Taskless skills into the current working directory. The subcommand SHALL also be available as `taskless update` (alias with identical behavior).

#### Scenario: Running taskless init installs skills

- **WHEN** a user runs `taskless init` in a repository with at least one detected AI tool directory
- **THEN** the CLI SHALL write skill files into each detected tool's directory
- **AND** report which tools were updated and how many skills were installed

#### Scenario: Running taskless update behaves identically to init

- **WHEN** a user runs `taskless update`
- **THEN** the behavior SHALL be identical to `taskless init`

#### Scenario: Running init with no detected tools writes AGENTS.md

- **WHEN** a user runs `taskless init` in a repository with no detected AI tool directories
- **THEN** the CLI SHALL create or update an `AGENTS.md` file in the working directory
- **AND** report that no tool directories were found and AGENTS.md was written as fallback

### Requirement: Tool detection via filesystem inspection

The CLI SHALL detect installed AI tools by checking for known directories via parallel `fs.stat` calls. Detection SHALL NOT rely on a config file. The tool registry SHALL be a typed array of tool descriptors maintained in `cli/src/actions/install.ts`.

#### Scenario: Claude Code is detected

- **WHEN** a `.claude/` directory exists in the working directory
- **THEN** the CLI SHALL detect Claude Code as an installed tool

#### Scenario: Multiple tools are detected

- **WHEN** multiple known tool directories exist (e.g., `.claude/` and `.cursor/`)
- **THEN** the CLI SHALL detect all of them and install skills for each

#### Scenario: No tools are detected

- **WHEN** no known tool directories exist in the working directory
- **THEN** the CLI SHALL fall back to AGENTS.md installation

### Requirement: Skills are installed as Agent Skills spec SKILL.md files

For each detected tool that supports skills, the CLI SHALL write SKILL.md files into the tool's skill directory. Skill directory names SHALL be prefixed with `taskless-` to namespace them. The installed SKILL.md content SHALL match the canonical source with the `name` field updated to include the `taskless-` prefix.

#### Scenario: Skill installed with namespaced directory

- **WHEN** the CLI installs the `info` skill for Claude Code
- **THEN** it SHALL write to `.claude/skills/taskless-info/SKILL.md`
- **AND** the `name` field in the SKILL.md frontmatter SHALL be `taskless-info`

#### Scenario: Skill content matches source

- **WHEN** a skill is installed
- **THEN** the SKILL.md body content SHALL be identical to the canonical source in `plugins/taskless/skills/`
- **AND** only the `name` field in frontmatter SHALL differ (prefixed with `taskless-`)

### Requirement: Claude Code commands are derived from skills

For Claude Code specifically, the CLI SHALL also generate command `.md` files derived from the canonical SKILL.md files. Commands SHALL be placed in the tool's commands directory under a `taskless` namespace.

#### Scenario: Command file is derived and installed

- **WHEN** the CLI installs skills for Claude Code
- **THEN** it SHALL also write command files to `.claude/commands/taskless/<name>.md`

#### Scenario: Command frontmatter is transformed from skill

- **WHEN** a command file is derived from a skill
- **THEN** the command frontmatter SHALL have a display `name` (e.g., `"Taskless: Info"`), a `description`, `category: "Taskless"`, and `tags` including `"taskless"`
- **AND** the command frontmatter SHALL include the `metadata` field from the source skill (preserving `version` for staleness checks)
- **AND** the command body SHALL be the skill's body content

### Requirement: AGENTS.md fallback uses comment region markers

When no tool directories are detected, the CLI SHALL write or update a region in `AGENTS.md` delimited by `<!-- BEGIN taskless version x.y.z -->` and `<!-- END taskless -->` comment markers. The version in the opening marker SHALL match the CLI's package version.

#### Scenario: AGENTS.md is created when it does not exist

- **WHEN** `taskless init` runs with no tool directories and no existing `AGENTS.md`
- **THEN** the CLI SHALL create `AGENTS.md` containing the taskless region

#### Scenario: AGENTS.md region is replaced on update

- **WHEN** `taskless init` runs and an `AGENTS.md` with existing taskless markers exists
- **THEN** the CLI SHALL replace the content between the markers with the updated content
- **AND** all content outside the markers SHALL be preserved

#### Scenario: AGENTS.md content is a CLI pointer

- **WHEN** the taskless region is written to AGENTS.md
- **THEN** the content SHALL include instructions to use `pnpm dlx @taskless/cli` or `npx @taskless/cli` for capability discovery
- **AND** SHALL include a brief listing of available CLI commands and their purpose

### Requirement: Skills are bundled into the CLI at build time

The CLI build SHALL embed all skill file content from `plugins/taskless/skills/` into the compiled bundle using Vite's `import.meta.glob` with raw file imports. No runtime file reads or network fetches SHALL be used to access skill content.

#### Scenario: Embedded skills are available at runtime

- **WHEN** the CLI runs `taskless init`
- **THEN** it SHALL access skill content from the embedded bundle without reading the filesystem or making network requests

#### Scenario: Build includes all skills from source directory

- **WHEN** `pnpm build` is run in `packages/cli/`
- **THEN** every `SKILL.md` file under `plugins/taskless/skills/` SHALL be embedded in the output bundle

### Requirement: Init respects the global working directory flag

The `init` subcommand SHALL use the resolved working directory from the global `-d` flag (or `process.cwd()` if not specified) as the target directory for tool detection and skill installation.

#### Scenario: Init uses custom directory

- **WHEN** a user runs `taskless init -d /path/to/repo`
- **THEN** tool detection and skill installation SHALL operate on `/path/to/repo`

#### Scenario: Init defaults to current directory

- **WHEN** a user runs `taskless init` without `-d`
- **THEN** tool detection and skill installation SHALL operate on `process.cwd()`
