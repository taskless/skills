# CLI Auth

## ADDED Requirements

### Requirement: Per-repository token storage in .env.local.json

The `taskless auth login` command SHALL store the auth token in `.taskless/.env.local.json` in the current repository, in addition to the existing global XDG config location. The per-repo file SHALL be a JSON object containing the `access_token` and any additional OAuth response fields. The file SHALL be created with permissions `0600`.

#### Scenario: Login writes to per-repo .env.local.json

- **WHEN** a user runs `taskless auth login` in a git repository
- **THEN** the CLI SHALL write the token to `.taskless/.env.local.json` in the repository root
- **AND** the CLI SHALL ensure `.taskless/.gitignore` exists with `.env.local.json` listed

#### Scenario: Login also writes to global auth.json

- **WHEN** a user runs `taskless auth login`
- **THEN** the CLI SHALL continue to write to the global XDG config location (`~/.config/taskless/auth.json`)
- **AND** the CLI SHALL write to `.taskless/.env.local.json` if in a git repository

#### Scenario: .taskless/ directory is created if missing

- **WHEN** `.taskless/` does not exist in the repository root
- **THEN** the CLI SHALL create it before writing `.env.local.json`

### Requirement: Token resolution prefers per-repo over global

When resolving the current authentication token, the CLI SHALL check in this order: (1) `TASKLESS_TOKEN` environment variable, (2) `.taskless/.env.local.json` in the working directory, (3) global `~/.config/taskless/auth.json`. The first available token SHALL be used.

#### Scenario: Env var takes precedence over all files

- **WHEN** `TASKLESS_TOKEN` is set and both `.env.local.json` and global auth file exist
- **THEN** the CLI SHALL use the `TASKLESS_TOKEN` value

#### Scenario: Per-repo file takes precedence over global

- **WHEN** `TASKLESS_TOKEN` is not set, `.taskless/.env.local.json` exists, and global auth file exists
- **THEN** the CLI SHALL use the token from `.taskless/.env.local.json`

#### Scenario: Global file used as fallback

- **WHEN** `TASKLESS_TOKEN` is not set and `.taskless/.env.local.json` does not exist
- **THEN** the CLI SHALL use the token from the global auth file

#### Scenario: No token available

- **WHEN** `TASKLESS_TOKEN` is not set, no `.env.local.json` exists, and no global auth file exists
- **THEN** token resolution SHALL return undefined

### Requirement: CLI warns if .env.local.json is tracked by git

On any command that reads from `.taskless/.env.local.json`, the CLI SHALL check whether the file is tracked by git. If tracked, the CLI SHALL print a warning to stderr.

#### Scenario: .env.local.json is tracked

- **WHEN** the CLI reads `.taskless/.env.local.json` and the file is tracked by git (i.e., `git ls-files .taskless/.env.local.json` returns output)
- **THEN** the CLI SHALL print a warning to stderr: "Warning: .taskless/.env.local.json is tracked by git. This file contains authentication tokens and should be gitignored."

#### Scenario: .env.local.json is not tracked

- **WHEN** the CLI reads `.taskless/.env.local.json` and the file is not tracked by git
- **THEN** the CLI SHALL NOT print any warning

## MODIFIED Requirements

### Requirement: Auth logout removes saved token

The `taskless auth logout` command SHALL remove the saved authentication token from all locations: the per-repo `.taskless/.env.local.json` (if present) and the global XDG config auth file. If no token exists in any location, it SHALL inform the user they are not logged in.

#### Scenario: Successful logout removes per-repo and global tokens

- **WHEN** a user runs `taskless auth logout` and both `.taskless/.env.local.json` and global auth file exist
- **THEN** the CLI SHALL delete both files
- **AND** the CLI SHALL print a confirmation message

#### Scenario: Logout removes only per-repo token

- **WHEN** a user runs `taskless auth logout` and only `.taskless/.env.local.json` exists
- **THEN** the CLI SHALL delete `.taskless/.env.local.json`
- **AND** the CLI SHALL print a confirmation message

#### Scenario: Logout removes only global token

- **WHEN** a user runs `taskless auth logout` and only the global auth file exists
- **THEN** the CLI SHALL delete the global auth file
- **AND** the CLI SHALL print a confirmation message

#### Scenario: Logout when not logged in

- **WHEN** a user runs `taskless auth logout` and no token files exist
- **THEN** the CLI SHALL print a message indicating the user is not logged in
