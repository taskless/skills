## ADDED Requirements

### Requirement: Check subcommand validates .taskless project setup

The CLI SHALL support a `taskless check` subcommand that validates the `.taskless/` directory exists and contains a valid `taskless.json` file before proceeding with any scanning.

#### Scenario: Check fails when .taskless/taskless.json is missing

- **WHEN** a user runs `taskless check` in a directory without `.taskless/taskless.json`
- **THEN** the CLI SHALL print an error message indicating the project is not set up
- **AND** the CLI SHALL exit with code 1

#### Scenario: Check succeeds when .taskless/taskless.json exists

- **WHEN** a user runs `taskless check` in a directory with a valid `.taskless/taskless.json`
- **THEN** the CLI SHALL proceed to scan for rules

### Requirement: Check subcommand warns when no rules exist

The CLI SHALL check for the presence of YAML rule files in the `.taskless/rules/` directory. When no rule files are found, the CLI SHALL warn the user and exit cleanly.

#### Scenario: No rule files in rules directory

- **WHEN** a user runs `taskless check` and `.taskless/rules/` contains no `.yml` files
- **THEN** the CLI SHALL print a warning message indicating no rules were found
- **AND** the CLI SHALL exit with code 0

#### Scenario: Rules directory contains rule files

- **WHEN** a user runs `taskless check` and `.taskless/rules/` contains one or more `.yml` files
- **THEN** the CLI SHALL proceed to run the scanner

### Requirement: Check subcommand executes ast-grep scan

The CLI SHALL execute `sg scan --config .taskless/sgconfig.yml --json=stream` using `child_process.spawn` with `shell: true` for cross-platform binary resolution. The `sg` binary SHALL be resolved from the `@ast-grep/cli` dependency via PATH.

#### Scenario: ast-grep scan runs with correct config

- **WHEN** the CLI executes the scanner
- **THEN** it SHALL invoke `sg scan` with `--config .taskless/sgconfig.yml` and `--json=stream`
- **AND** the working directory for the spawned process SHALL be the resolved project directory

#### Scenario: ast-grep binary is not found

- **WHEN** the `sg` binary cannot be resolved from PATH
- **THEN** the CLI SHALL print an error message indicating ast-grep is not available
- **AND** the CLI SHALL exit with code 1

### Requirement: Check subcommand maps ast-grep output to CheckResult

The CLI SHALL parse the JSONL stream from `sg scan --json=stream` and map each match object to an internal `CheckResult` type. The `CheckResult` type SHALL include: `source` (string), `ruleId` (string), `severity` ("error" | "warning" | "info" | "hint"), `message` (string), `note` (optional string), `file` (string), `range` (start/end with line and column), `matchedText` (string), and `fix` (optional string).

#### Scenario: ast-grep match is mapped to CheckResult

- **WHEN** ast-grep outputs a JSON match object with `ruleId`, `severity`, `message`, `text`, `file`, and `range`
- **THEN** the CLI SHALL produce a `CheckResult` with `source` set to `"ast-grep"` and all other fields mapped from the match object

#### Scenario: ast-grep match with note and fix

- **WHEN** ast-grep outputs a match with `note` and `replacement` fields
- **THEN** the `CheckResult` SHALL include the `note` and `fix` values

### Requirement: Check subcommand formats human-readable output by default

When the `--json` flag is not set, the CLI SHALL format `CheckResult` items as human-readable diagnostic output to stdout. Each result SHALL display the file path with line and column, severity and rule ID, message, matched source text, and optional note.

#### Scenario: Human output for a single error

- **WHEN** the scanner produces one error-severity result in `src/utils.ts` at line 42 column 5
- **THEN** stdout SHALL include the file location, severity tag, rule ID, message, and matched text in a readable format

#### Scenario: Human output summary

- **WHEN** the scanner completes with results
- **THEN** stdout SHALL include a summary line with the count of issues by severity and the number of files scanned

#### Scenario: Human output with no issues found

- **WHEN** the scanner completes with zero results
- **THEN** stdout SHALL indicate that no issues were found

### Requirement: Check subcommand formats JSON output when --json is set

When the `--json` flag is set, the CLI SHALL output each `CheckResult` as a JSON object per line (JSONL format) to stdout.

#### Scenario: JSON output streams results

- **WHEN** the `--json` flag is set and the scanner produces results
- **THEN** each `CheckResult` SHALL be written as a single-line JSON object to stdout, one per line

#### Scenario: JSON output with no issues

- **WHEN** the `--json` flag is set and the scanner produces zero results
- **THEN** stdout SHALL contain no output lines

### Requirement: Check subcommand exit codes reflect error severity

The CLI SHALL exit with code 0 when no error-severity matches are found (including when only warnings, info, or hints exist). The CLI SHALL exit with code 1 when at least one error-severity match is found.

#### Scenario: Exit 0 when clean

- **WHEN** the scanner produces zero results
- **THEN** the process SHALL exit with code 0

#### Scenario: Exit 0 when only warnings

- **WHEN** the scanner produces results but none have severity "error"
- **THEN** the process SHALL exit with code 0

#### Scenario: Exit 1 when errors found

- **WHEN** the scanner produces at least one result with severity "error"
- **THEN** the process SHALL exit with code 1

### Requirement: Check subcommand respects global working directory flag

The `check` subcommand SHALL use the resolved working directory from the global `-d` flag (or `process.cwd()` if not specified) as the target directory for `.taskless/` validation and scanner execution.

#### Scenario: Check uses custom directory

- **WHEN** a user runs `taskless check -d /path/to/repo`
- **THEN** `.taskless/` validation and scanning SHALL operate on `/path/to/repo`

#### Scenario: Check defaults to current directory

- **WHEN** a user runs `taskless check` without `-d`
- **THEN** `.taskless/` validation and scanning SHALL operate on `process.cwd()`
