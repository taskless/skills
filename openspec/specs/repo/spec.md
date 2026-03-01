## ADDED Requirements

### Requirement: Turborepo is configured at the repo root

The repository SHALL have `turbo` as a root devDependency and a `turbo.json` configuration file at the repo root.

#### Scenario: Turborepo is installed

- **WHEN** `pnpm install` is run at the repo root
- **THEN** the `turbo` binary SHALL be available

#### Scenario: turbo.json exists

- **WHEN** the repo root is inspected
- **THEN** a `turbo.json` file SHALL exist with valid Turborepo configuration

### Requirement: Build pipeline runs across all packages

The root `pnpm build` command SHALL invoke `turbo run build`, which runs the `build` script in every workspace package that defines one. Build outputs (`dist/**`) SHALL be cached.

#### Scenario: Root build command runs CLI build

- **WHEN** `pnpm build` is run at the repo root
- **THEN** Turborepo SHALL execute `build` in `@taskless/cli`
- **AND** the CLI `dist/` output SHALL be produced

#### Scenario: Cached build skips re-execution

- **WHEN** `pnpm build` is run twice without source changes
- **THEN** the second run SHALL be a cache hit and complete near-instantly

### Requirement: Test pipeline runs across all packages

The root `pnpm test` command SHALL invoke `turbo run test`, which runs the `test` script in every workspace package that defines one. The test pipeline SHALL depend on the build pipeline so that built artifacts are available.

#### Scenario: Root test command runs CLI tests

- **WHEN** `pnpm test` is run at the repo root
- **THEN** Turborepo SHALL execute `test` in `@taskless/cli`
- **AND** the build pipeline SHALL run first if needed

### Requirement: Typecheck pipeline runs across all packages

The root `pnpm typecheck` command SHALL invoke `turbo run typecheck`, which runs the `typecheck` script in every workspace package that defines one.

#### Scenario: Root typecheck command runs CLI typecheck

- **WHEN** `pnpm typecheck` is run at the repo root
- **THEN** Turborepo SHALL execute `typecheck` in `@taskless/cli`
