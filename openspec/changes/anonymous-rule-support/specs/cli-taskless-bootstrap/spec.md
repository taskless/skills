## ADDED Requirements

### Requirement: Migration-based .taskless directory management

The CLI SHALL provide an `ensureTasklessDirectory(cwd)` function that uses a migration system to create and upgrade the `.taskless/` directory. Migrations SHALL be defined as a `Record<string, Migration>` where each migration is an idempotent async function with signature `(dir: string) => Promise<undefined>`.

#### Scenario: First run bootstraps directory via migrations

- **WHEN** an action calls `ensureTasklessDirectory()` and `.taskless/` does not exist
- **THEN** it SHALL create `.taskless/taskless.json` with `{ "version": 0 }`
- **AND** run all registered migrations in order
- **AND** update `taskless.json` version to the total migration count

#### Scenario: Up-to-date directory is a no-op

- **WHEN** `ensureTasklessDirectory()` is called and `taskless.json` version matches the total migration count
- **THEN** it SHALL return immediately without running any migrations

#### Scenario: Outdated directory runs only new migrations

- **WHEN** `taskless.json` has `{ "version": 1 }` and 3 migrations are registered
- **THEN** `ensureTasklessDirectory()` SHALL run migrations 2 and 3 (skipping migration 1)
- **AND** update `taskless.json` version to 3

#### Scenario: Each migration is idempotent

- **WHEN** a migration runs against a directory where its changes already exist
- **THEN** it SHALL complete without errors and without duplicating files or content

### Requirement: Migrations are keyed by name for safe removal

Migrations SHALL be stored as a `Record<string, Migration>` with descriptive string keys (e.g., `"001-init"`). Ordering is by insertion order in the record. Older migrations MAY be removed once the minimum supported version advances.

#### Scenario: Migration keys are descriptive

- **WHEN** inspecting the migrations record
- **THEN** each key SHALL be a descriptive string identifying what the migration does

### Requirement: First migration creates initial directory structure

The first migration (`001-init`) SHALL create the initial `.taskless/` directory structure: `README.md` with usage documentation, `.gitignore` (via existing `ensureTasklessGitignore()` for `.env.local.json` and `sgconfig.yml`), `rules/` directory, and `rule-tests/` directory.

#### Scenario: README content

- **WHEN** the `001-init` migration runs
- **THEN** `.taskless/README.md` SHALL include a link to taskless.io, usage examples showing `pnpm dlx` and `npx` invocations of `@taskless/cli@latest check`, and a file listing describing `taskless.json`, `.env.local.json`, `rules/`, and `rule-tests/`

#### Scenario: Gitignore is created

- **WHEN** the `001-init` migration runs
- **THEN** `.taskless/.gitignore` SHALL contain entries for `.env.local.json` and `sgconfig.yml`

#### Scenario: Subdirectories are created

- **WHEN** the `001-init` migration runs
- **THEN** `.taskless/rules/` and `.taskless/rule-tests/` SHALL exist

### Requirement: Bootstrap is called from all write paths

The `ensureTasklessDirectory()` function SHALL be called from: `writeRuleFile()`, `writeRuleTestFile()`, `generateSgConfig()`, and the `rules verify` command. This ensures `.taskless/` is always properly initialized and up-to-date before any file writes.

#### Scenario: Rule file write triggers bootstrap

- **WHEN** `writeRuleFile()` is called and `.taskless/` does not exist
- **THEN** `ensureTasklessDirectory()` SHALL run before writing the rule file

#### Scenario: Verify command triggers bootstrap

- **WHEN** `taskless rules verify` runs and needs to generate `sgconfig.yml`
- **THEN** `ensureTasklessDirectory()` SHALL run as part of the `generateSgConfig()` call
