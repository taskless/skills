# CLI Check

## REMOVED Requirements

### Requirement: Check subcommand validates .taskless project setup

**Reason**: The `check` command no longer requires `taskless.json` or a configured scaffold. It only needs `.taskless/rules/` to contain rule files.

**Migration**: Replace the `taskless.json` validation with a direct check for `.taskless/rules/*.yml` files.

## ADDED Requirements

### Requirement: Check subcommand generates ephemeral sgconfig.yml

The `check` command SHALL generate an `sgconfig.yml` file in `.taskless/` before invoking ast-grep. The generated config SHALL set `ruleDirs` to `['rules']` and `testConfigs` to `[{testDir: 'rule-tests'}]`. The file SHALL be written to `.taskless/sgconfig.yml` which is gitignored via `.taskless/.gitignore`. If `.taskless/.gitignore` does not exist, the CLI SHALL create it before writing the config.

#### Scenario: sgconfig.yml is generated at check time

- **WHEN** a user runs `taskless check`
- **AND** `.taskless/rules/` contains rule files
- **THEN** the CLI SHALL write `.taskless/sgconfig.yml` with `ruleDirs: ['rules']`
- **AND** the CLI SHALL pass `--config .taskless/sgconfig.yml` to ast-grep

#### Scenario: Existing sgconfig.yml is overwritten

- **WHEN** `.taskless/sgconfig.yml` already exists (from a previous run or legacy scaffold)
- **THEN** the CLI SHALL overwrite it with the freshly generated content

### Requirement: Check subcommand works without taskless.json

The `check` command SHALL NOT require `.taskless/taskless.json` to exist. The command SHALL only require the presence of rule files in `.taskless/rules/`.

#### Scenario: Check succeeds without taskless.json

- **WHEN** a user runs `taskless check` in a directory with `.taskless/rules/*.yml` files but no `taskless.json`
- **THEN** the CLI SHALL proceed to generate `sgconfig.yml` and run the scanner

#### Scenario: Check exits cleanly with no .taskless/ directory

- **WHEN** a user runs `taskless check` in a directory without a `.taskless/` directory
- **THEN** the CLI SHALL print a message: "No rules configured. Create one with `taskless rules create`."
- **AND** the CLI SHALL exit with code 0

#### Scenario: Check exits cleanly with empty rules directory

- **WHEN** a user runs `taskless check` and `.taskless/rules/` contains no `.yml` files
- **THEN** the CLI SHALL print a warning that no rules were found
- **AND** the CLI SHALL exit with code 0

## MODIFIED Requirements

### Requirement: Check subcommand executes ast-grep scan

The CLI SHALL generate an ephemeral `sgconfig.yml` in `.taskless/` and execute `sg scan --config .taskless/sgconfig.yml --json=stream` using `child_process.spawn` with `shell: true` for cross-platform binary resolution. The `sg` binary SHALL be resolved from the `@ast-grep/cli` dependency via PATH.

#### Scenario: ast-grep scan runs with generated config

- **WHEN** the CLI executes the scanner
- **THEN** it SHALL first write `.taskless/sgconfig.yml` with `ruleDirs: ['rules']`
- **AND** it SHALL invoke `sg scan` with `--config .taskless/sgconfig.yml` and `--json=stream`
- **AND** the working directory for the spawned process SHALL be the resolved project directory

#### Scenario: ast-grep binary is not found

- **WHEN** the `sg` binary cannot be resolved from PATH
- **THEN** the CLI SHALL print an error message indicating ast-grep is not available
- **AND** the CLI SHALL exit with code 1
