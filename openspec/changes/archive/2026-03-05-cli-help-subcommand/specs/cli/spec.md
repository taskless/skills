## MODIFIED Requirements

### Requirement: CLI stub entry point

The CLI entry point SHALL use citty to define a main command with subcommand support and a global `-d` (alias `--dir`) argument that sets the working directory, and a global `--json` boolean argument for machine-readable output. When invoked with no arguments, the CLI SHALL display help text listing available subcommands. The CLI SHALL externalize Node.js built-in modules and bundle all other dependencies. The `check` subcommand, the `auth` subcommand group, the `rules` subcommand group, and the `help` subcommand SHALL be registered alongside existing subcommands.

#### Scenario: Running the CLI with no arguments shows help

- **WHEN** the CLI is executed with no arguments
- **THEN** it SHALL print help text to stdout listing available subcommands including `help`

#### Scenario: Running the CLI with an unknown subcommand shows help

- **WHEN** the CLI is executed with an unrecognized subcommand
- **THEN** it SHALL print help text to stdout

#### Scenario: Global -d flag is accepted

- **WHEN** the CLI is executed with `-d /some/path` or `--dir /some/path`
- **THEN** the specified path SHALL be available to all subcommands as the resolved working directory

#### Scenario: Working directory defaults to process.cwd()

- **WHEN** the CLI is executed without the `-d` flag
- **THEN** the working directory SHALL default to `process.cwd()`

#### Scenario: Global --json flag is accepted

- **WHEN** the CLI is executed with `--json`
- **THEN** the flag SHALL be available to all subcommands as `args.json`

#### Scenario: --json defaults to false

- **WHEN** a user runs a subcommand without `--json`
- **THEN** `args.json` SHALL be `false`

#### Scenario: Check subcommand is registered

- **WHEN** a user runs `taskless check`
- **THEN** the CLI SHALL route to the check subcommand handler

#### Scenario: Auth subcommand group is registered

- **WHEN** a user runs `taskless auth`
- **THEN** the CLI SHALL route to the auth subcommand group

#### Scenario: Rules subcommand group is registered

- **WHEN** a user runs `taskless rules`
- **THEN** the CLI SHALL route to the rules subcommand group

#### Scenario: Help subcommand is registered

- **WHEN** a user runs `taskless help`
- **THEN** the CLI SHALL route to the help subcommand handler

### Requirement: CLI builds with Vite

The CLI SHALL use Vite in library mode to produce a single bundled ESM output file. The build configuration SHALL live in `packages/cli/vite.config.ts`. The Vite build SHALL embed skills from `skills/`, commands from `commands/taskless/`, and help text files from `packages/cli/src/help/` via `import.meta.glob` with raw file imports. The build SHALL assert that every embedded skill's `metadata.version` matches the CLI's `package.json` version, failing with an error if any mismatch is detected.

#### Scenario: Build produces executable output

- **WHEN** `pnpm build` is run in `packages/cli/`
- **THEN** Vite SHALL produce a single file in `dist/` that is a valid Node.js ESM module with a shebang

#### Scenario: Build embeds skills from skills directory

- **WHEN** `pnpm build` is run in `packages/cli/`
- **THEN** every `SKILL.md` file under `skills/` at the repo root SHALL be embedded in the output bundle

#### Scenario: Build embeds commands from commands directory

- **WHEN** `pnpm build` is run in `packages/cli/`
- **THEN** every `.md` file under `commands/taskless/` at the repo root SHALL be embedded in the output bundle

#### Scenario: Build embeds help text files

- **WHEN** `pnpm build` is run in `packages/cli/`
- **THEN** every `.txt` file under `packages/cli/src/help/` SHALL be embedded in the output bundle

#### Scenario: Build fails on version mismatch

- **WHEN** any embedded SKILL.md has a `metadata.version` that differs from `packages/cli/package.json` version
- **THEN** the Vite build SHALL fail with an error identifying the mismatched skill(s)
