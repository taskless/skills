# Build Tooling

## Purpose

Defines the version sync script, command generation script, build-time version guard, and the root-level release pipeline via turbo.

## ADDED Requirements

### Requirement: tsx is available for build scripts

The root `package.json` SHALL declare `tsx` as a devDependency. All scripts in `scripts/` SHALL be TypeScript files executed via `tsx`.

#### Scenario: tsx is declared as a devDependency

- **WHEN** inspecting the root `package.json`
- **THEN** `tsx` SHALL be listed in `devDependencies`

#### Scenario: Scripts are executable with tsx

- **WHEN** running `tsx scripts/sync-skill-versions.ts`
- **THEN** the script SHALL execute without requiring additional configuration

### Requirement: Version sync script updates skill metadata

A `scripts/sync-skill-versions.ts` script SHALL read the version from `packages/cli/package.json` and update the `metadata.version` field in all `SKILL.md` files under `skills/`. The script SHALL be idempotent — if versions already match, no files SHALL be modified.

#### Scenario: Versions are out of sync

- **WHEN** `packages/cli/package.json` has version `0.1.0` and `skills/taskless-info/SKILL.md` has `metadata.version: "0.0.5"`
- **THEN** running the script SHALL update the SKILL.md to `metadata.version: "0.1.0"`

#### Scenario: Versions are already in sync

- **WHEN** all SKILL.md files already have `metadata.version` matching the CLI version
- **THEN** running the script SHALL make no file changes

#### Scenario: Multiple skills are updated

- **WHEN** 5 SKILL.md files exist under `skills/`
- **THEN** the script SHALL update all 5 files' `metadata.version` fields

### Requirement: Command generation script derives commands from skills

A `scripts/generate-commands.ts` script SHALL read all `skills/taskless-*/SKILL.md` files, transform them into command format, and write to `commands/taskless/`. The output filename SHALL strip the `taskless-` prefix from the skill directory name.

#### Scenario: Command is generated from skill

- **WHEN** `skills/taskless-auth-login/SKILL.md` exists with name `taskless-auth-login` and description `"Explains how to log in"`
- **THEN** running the script SHALL write `commands/taskless/auth-login.md`
- **AND** the command frontmatter SHALL have `name: "Taskless: Auth Login"`, `description: "Explains how to log in"`, `category: "Taskless"`, and `tags: ["taskless"]`
- **AND** the command body SHALL match the skill body

#### Scenario: All skills produce commands

- **WHEN** 5 skill directories exist under `skills/`
- **THEN** running the script SHALL produce 5 command files under `commands/taskless/`

#### Scenario: Metadata is preserved in commands

- **WHEN** a skill has `metadata: { author: "taskless", version: "0.1.0" }`
- **THEN** the generated command SHALL include the same `metadata` field in frontmatter

### Requirement: Version sync runs as part of changeset version

The root `package.json` SHALL define a `version` script that runs `changeset version` followed by `tsx scripts/sync-skill-versions.ts`. This ensures skill versions are updated in the same commit as the package version bump.

#### Scenario: Version script chains changeset and sync

- **WHEN** a developer runs `pnpm version`
- **THEN** `changeset version` SHALL run first to bump `packages/cli/package.json`
- **AND** `sync-skill-versions.ts` SHALL run second to update SKILL.md files
- **AND** all changes SHALL be in the working directory ready for commit

### Requirement: Build-time version assertion

The CLI's Vite build SHALL assert that every embedded skill's `metadata.version` matches the CLI's `package.json` version. If any skill has a mismatched version, the build SHALL fail with an error identifying the mismatched skill(s).

#### Scenario: All versions match

- **WHEN** all embedded SKILL.md files have `metadata.version` matching the CLI version
- **THEN** the Vite build SHALL succeed

#### Scenario: Version mismatch detected

- **WHEN** `skills/taskless-info/SKILL.md` has `metadata.version: "0.0.4"` but the CLI is at `0.0.5`
- **THEN** the Vite build SHALL fail with an error message identifying `taskless-info` as having version `0.0.4` (expected `0.0.5`)

### Requirement: CLI release script is removed

The `packages/cli/package.json` SHALL NOT have a `release` script. Build and publish SHALL be orchestrated from the root via turbo.

#### Scenario: No release script in CLI package

- **WHEN** inspecting `packages/cli/package.json` scripts
- **THEN** there SHALL be no `release` key
