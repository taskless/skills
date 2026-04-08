# CLI Init

## Purpose

TBD — Defines the `taskless init` subcommand that installs Taskless skills into a repository by detecting AI tools and writing skill files.

## Requirements

### Requirement: Init subcommand installs skills into a repository

The CLI SHALL support a `taskless init` subcommand that installs Taskless skills into the current working directory. The subcommand SHALL also be available as `taskless update` (alias with identical behavior). When no tool directories are detected, the CLI SHALL install skills to `.agents/skills/<name>/SKILL.md` as a fallback.

#### Scenario: Running taskless init installs skills

- **WHEN** a user runs `taskless init` in a repository with at least one detected AI tool
- **THEN** the CLI SHALL write skill files into each detected tool's directory
- **AND** report which tools were updated and how many skills were installed

#### Scenario: Running taskless update behaves identically to init

- **WHEN** a user runs `taskless update`
- **THEN** the behavior SHALL be identical to `taskless init`

#### Scenario: Running init with no detected tools uses fallback

- **WHEN** a user runs `taskless init` in a repository with no detected AI tool signals
- **THEN** the CLI SHALL install skills to `.agents/skills/`
- **AND** report that the fallback location was used

### Requirement: Tool detection via filesystem inspection

The CLI SHALL detect installed AI tools by checking for known detection signals (files and directories) via parallel filesystem checks. Detection SHALL NOT rely on a config file. The tool registry SHALL be a typed array of tool descriptors maintained in `packages/cli/src/install/install.ts`. Each tool descriptor SHALL have a `detect` array of signals and a separate `installDir` for the install root.

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

### Requirement: Detection checks files with access and directories with stat

Directory detection signals SHALL use `fs.stat()` and verify `isDirectory()`. File detection signals SHALL use `fs.access()` with `constants.F_OK` for existence checking. All detection checks SHALL run in parallel.

#### Scenario: Directory signal uses stat

- **WHEN** a directory detection signal is evaluated
- **THEN** `fs.stat()` SHALL be called on the path
- **AND** `isDirectory()` SHALL return true for detection to succeed

#### Scenario: File signal uses access

- **WHEN** a file detection signal is evaluated
- **THEN** `fs.access()` SHALL be called with `constants.F_OK`

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
