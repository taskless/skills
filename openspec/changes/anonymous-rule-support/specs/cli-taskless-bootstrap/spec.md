## ADDED Requirements

### Requirement: Migration-based .taskless directory management

The CLI SHALL provide an `ensureTasklessDirectory(cwd)` function in `filesystem/directory.ts` that creates the `.taskless/` directory and delegates to `runMigrations()` in `filesystem/migrate.ts`. Migrations SHALL be defined as a `Record<string, Migration>` where each migration is an idempotent async function with signature `(directory: string) => Promise<void>`.

#### Scenario: First run bootstraps directory via migrations

- **WHEN** an action calls `ensureTasklessDirectory()` and `.taskless/` does not exist
- **THEN** it SHALL create `.taskless/taskless.json` with `{ "version": 0 }`
- **AND** run all registered migrations in order
- **AND** update `taskless.json` version to the max migration key

#### Scenario: Up-to-date directory is a no-op

- **WHEN** `ensureTasklessDirectory()` is called and `taskless.json` version equals the max migration key
- **THEN** it SHALL return immediately without running any migrations

#### Scenario: Outdated directory runs only new migrations

- **WHEN** `taskless.json` has `{ "version": 1 }` and migrations `"1"`, `"2"`, `"3"` are registered
- **THEN** `ensureTasklessDirectory()` SHALL run migrations 2 and 3 (skipping migration 1)
- **AND** update `taskless.json` version to 3

#### Scenario: Non-numeric version is treated as 0

- **WHEN** `taskless.json` has a non-numeric version (e.g., `"2026-03-02"` from v0 scaffold)
- **THEN** the migration runner SHALL treat it as version 0 and run all migrations

#### Scenario: Each migration is idempotent

- **WHEN** a migration runs against a directory where its changes already exist
- **THEN** it SHALL complete without errors and without duplicating files or content

### Requirement: Migrations are keyed numerically and sorted at runtime

Migrations SHALL be stored as a `Record<string, Migration>` with numeric string keys (e.g., `"1"`, `"2"`, `"3"`). Keys are cast to `Number` and sorted numerically at runtime via `toSorted()`. Older migrations MAY be removed once the minimum supported version advances.

#### Scenario: Migrations are sorted numerically

- **WHEN** the migration runner processes the registry
- **THEN** migrations SHALL be sorted by their numeric key value, not by insertion order

### Requirement: First migration creates initial directory structure

The first migration (`"1"` in `filesystem/migrations/0001-init.ts`) SHALL create the initial `.taskless/` directory structure: `README.md` with usage documentation (always overwritten), `.gitignore` entries via `addToGitignore(cwd, [".env.local.json", "sgconfig.yml"])`, `rules/` directory, and `rule-tests/` directory.

#### Scenario: README content

- **WHEN** migration `"1"` runs
- **THEN** `.taskless/README.md` SHALL be written (overwriting any existing content) with a link to taskless.io, usage examples showing `pnpm dlx` and `npx` invocations of `@taskless/cli@latest check`, and a file listing describing `taskless.json`, `.env.local.json`, `rules/`, and `rule-tests/`

#### Scenario: Gitignore is created

- **WHEN** migration `"1"` runs
- **THEN** `.taskless/.gitignore` SHALL contain entries for `.env.local.json` and `sgconfig.yml`

#### Scenario: Subdirectories are created

- **WHEN** migration `"1"` runs
- **THEN** `.taskless/rules/` and `.taskless/rule-tests/` SHALL exist

### Requirement: Filesystem utilities are generic

The `filesystem/` module SHALL provide generic utilities that migrations compose:

- `addToGitignore(cwd, globs)`: Idempotently adds glob patterns to `.taskless/.gitignore`
- `generateSgConfig(cwd)`: Writes ephemeral `sgconfig.yml` with `ruleDirs` and `testConfigs`

These utilities SHALL NOT hardcode Taskless-specific entries — the migrations decide what to pass.

#### Scenario: addToGitignore is idempotent

- **WHEN** `addToGitignore(cwd, [".env.local.json"])` is called twice
- **THEN** `.env.local.json` SHALL appear exactly once in `.taskless/.gitignore`

### Requirement: Bootstrap is called from all write paths

The `ensureTasklessDirectory()` function SHALL be called from: `writeRuleFile()`, `writeRuleTestFile()`, `generateSgConfig()`, and the `rules verify` command. This ensures `.taskless/` is always properly initialized and up-to-date before any file writes.

#### Scenario: Rule file write triggers bootstrap

- **WHEN** `writeRuleFile()` is called and `.taskless/` does not exist
- **THEN** `ensureTasklessDirectory()` SHALL run before writing the rule file

#### Scenario: Verify command triggers bootstrap

- **WHEN** `taskless rules verify` runs and needs to generate `sgconfig.yml`
- **THEN** `ensureTasklessDirectory()` SHALL run as part of the `generateSgConfig()` call
