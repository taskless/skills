# CLI Check

## Purpose

TBD — Defines the `taskless check` subcommand that validates project setup and runs ast-grep scanning to detect rule violations.

## Requirements

### Requirement: Check subcommand works without taskless.json

The `check` command SHALL NOT require `.taskless/taskless.json` to exist. The command SHALL only require the presence of rule files in `.taskless/rules/`.

#### Scenario: Check succeeds without taskless.json

- **WHEN** a user runs `taskless check` in a directory with `.taskless/rules/*.yml` files but no `taskless.json`
- **THEN** the CLI SHALL proceed to generate `sgconfig.yml` and run the scanner

#### Scenario: Check exits cleanly with no .taskless/ directory

- **WHEN** a user runs `taskless check` in a directory without a `.taskless/` directory
- **THEN** the CLI SHALL print a message: "No rules configured. Create one with `taskless rule create`."
- **AND** the CLI SHALL exit with code 0

#### Scenario: Check exits cleanly with empty rules directory

- **WHEN** a user runs `taskless check` and `.taskless/rules/` contains no `.yml` files
- **THEN** the CLI SHALL print a warning that no rules were found
- **AND** the CLI SHALL exit with code 0

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

The CLI SHALL generate an ephemeral `sgconfig.yml` in `.taskless/` and execute
`sg scan --config .taskless/sgconfig.yml --json=stream` using `child_process.spawn` with
`shell: true` for cross-platform binary resolution. The `sg` binary SHALL be resolved from
the `@ast-grep/cli` dependency via PATH. When reconciliation succeeds, the scan SHALL cover
only the blessed `run`-set rule files; on the unauthenticated/`--anonymous` path, or when an
authenticated reconciliation degrades to a local scan, the scan SHALL cover all local rule
files as before.

#### Scenario: ast-grep scan runs with generated config

- **WHEN** the CLI executes the scanner
- **THEN** it SHALL first write `.taskless/sgconfig.yml`
- **AND** it SHALL invoke `sg scan` with `--config .taskless/sgconfig.yml` and `--json=stream`
- **AND** the working directory for the spawned process SHALL be the resolved project directory

#### Scenario: Scan is limited to the run set when reconciled

- **WHEN** reconciliation succeeded and returned a `run` set
- **THEN** the generated scan configuration SHALL cause `sg scan` to evaluate only the
  `run`-set rule files

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

### Requirement: Check accepts positional path arguments

The `check` subcommand SHALL accept zero or more positional path arguments. When zero paths are passed, the CLI SHALL scan the full project directory (existing behavior). When one or more paths are passed, the CLI SHALL forward those paths to `sg scan` so that only the specified files and directories are scanned. Paths SHALL be treated relative to the resolved working directory (`-d` / `process.cwd()`).

Before forwarding, the CLI SHALL silently drop any path that does not exist on disk at invocation time. This lets CI pipelines pipe raw git-diff output directly (e.g. `taskless check $(git diff --name-only main...HEAD)`) without pre-filtering deleted files. If every supplied path is filtered out and the original argument list was non-empty, the CLI SHALL exit with code 0 and print no matches (interpreted as "nothing changed, nothing to scan").

#### Scenario: Zero path arguments scans the whole project

- **WHEN** a user runs `taskless check`
- **THEN** `sg scan` SHALL be invoked without any trailing path arguments
- **AND** the scan SHALL cover the entire resolved working directory

#### Scenario: Explicit paths limit the scan

- **WHEN** a user runs `taskless check src/foo.ts src/bar.ts`
- **AND** both files exist on disk
- **THEN** `sg scan` SHALL be invoked with `src/foo.ts` and `src/bar.ts` as trailing arguments
- **AND** the scan SHALL NOT include files outside those two paths

#### Scenario: Non-existent paths are silently filtered

- **WHEN** a user runs `taskless check src/present.ts src/deleted.ts`
- **AND** `src/present.ts` exists but `src/deleted.ts` does not
- **THEN** the CLI SHALL forward only `src/present.ts` to `sg scan`
- **AND** SHALL NOT error on the missing path

#### Scenario: All paths filtered out exits cleanly

- **WHEN** a user runs `taskless check src/deleted-a.ts src/deleted-b.ts`
- **AND** neither file exists on disk
- **THEN** the CLI SHALL exit with code 0
- **AND** SHALL NOT invoke `sg scan`
- **AND** SHALL report no results (empty results array in JSON mode)

#### Scenario: Relative paths resolve against the working directory

- **WHEN** a user runs `taskless check -d /path/to/project src/foo.ts`
- **AND** `/path/to/project/src/foo.ts` exists
- **THEN** the CLI SHALL treat `src/foo.ts` as relative to `/path/to/project`
- **AND** SHALL forward that relative path to `sg scan` with `cwd = /path/to/project`

#### Scenario: Directory paths are accepted

- **WHEN** a user runs `taskless check src/`
- **AND** `src/` is a directory
- **THEN** the CLI SHALL forward `src/` to `sg scan`
- **AND** the scan SHALL cover files under that directory

### Requirement: Check accepts --anonymous as a no-op

The `taskless check` command SHALL accept the global `--anonymous` flag (per the `cli`
capability). Because `check` reconciles against the Taskless API when authenticated,
`--anonymous` SHALL force the logged-out path: it SHALL suppress the reconcile network call
and run all local rule files. Aside from forcing the logged-out path, `--anonymous` SHALL NOT
change scan behavior, output shape, or exit codes relative to an unauthenticated `check`.

#### Scenario: check --anonymous skips reconciliation

- **WHEN** a user runs `taskless check --anonymous`
- **THEN** the CLI SHALL NOT call `POST /cli/api/reconcile`
- **AND** SHALL scan all local rule files

#### Scenario: check --anonymous matches an unauthenticated check

- **WHEN** a user runs `taskless check --anonymous`
- **THEN** its scan behavior, output, and exit code SHALL match `taskless check` run with no
  available token

### Requirement: Check error output uses standardized error envelope

When `taskless check --json` exits with an error, the output SHALL conform to the standardized error envelope `{ "ok": false, "code": "<CODE>", "message": "<...>" }` per the `cli` capability requirements. Existing success-shape requirements for `--json` are unchanged.

#### Scenario: check --json error uses standardized envelope

- **WHEN** `taskless check --json` fails (e.g. ast-grep invocation error)
- **THEN** stdout SHALL contain a JSON object matching the standardized error envelope
- **AND** SHALL include a stable `code` field (e.g. `SCAN_FAILED` if added to the enum)

### Requirement: Check selects what it runs from auth state

`taskless check` SHALL NOT require authentication, and it SHALL choose what it runs from the current auth state. When no token is available, or when `--anonymous` is set, the CLI SHALL run all local rule files under `.taskless/rules/` without contacting the server (the offline linter posture). When a token is available and `--anonymous` is not set, the CLI SHALL reconcile against the server (per "Check reconciles rule files before scanning") and run only the returned `run` set. The unauthenticated path SHALL succeed with no network access and SHALL NOT emit a warning; any informational notice on that path is optional.

#### Scenario: Unauthenticated check runs local rules

- **WHEN** a user runs `taskless check` with no available token
- **THEN** the CLI SHALL scan all local rule files
- **AND** SHALL NOT call `POST /cli/api/reconcile`
- **AND** SHALL NOT emit a warning about missing authentication

#### Scenario: Authenticated check reconciles

- **WHEN** a user runs `taskless check` with an available token and without `--anonymous`
- **THEN** the CLI SHALL call `POST /cli/api/reconcile` and run only the `run` set

#### Scenario: Anonymous forces the logged-out path

- **WHEN** a user runs `taskless check --anonymous` while a token is available
- **THEN** the CLI SHALL behave exactly as an unauthenticated `check` (run all local rules, no reconcile call)

### Requirement: Check reconciles rule files before scanning

`taskless check` SHALL reconcile before scanning whenever a bearer token and a `repositoryUrl` are resolvable and `--anonymous` is not set. It SHALL compute the signature envelope for every `.yml` file under `.taskless/rules/`, call `POST /cli/api/reconcile` with `{ repositoryUrl, files }`, and then scan **only** the files returned in the `run` set, matched back to local files by signature (per the `cli-rule-reconciliation` capability).

#### Scenario: Only blessed rules are scanned

- **WHEN** a user runs `taskless check` while authenticated and reconciliation returns a
  `run` set that is a subset of the local rule files
- **THEN** the CLI SHALL invoke `sg scan` against only the `run`-set rule files
- **AND** SHALL NOT scan any local rule file absent from `run`

### Requirement: Check warns on reconciliation mismatches

`taskless check` SHALL warn on every mismatch reported by a successful reconciliation and SHALL NOT let those warnings change the exit code. `unsafe` entries SHALL be warned as tamper/drift, `unknown` as not-issued-by-the-server, and `missing` as audit-only. The exit code SHALL continue to be governed solely by error-severity scan results from the executed `run` set. Warnings SHALL be human-readable output only; when `--json` is set the output SHALL remain the existing `{ success, results }` shape and SHALL NOT include the warnings.

#### Scenario: Unsafe drift is warned without failing the exit code

- **WHEN** reconciliation returns an `unsafe` entry and the `run`-set scan produces no
  error-severity results
- **THEN** the CLI SHALL warn about the drift
- **AND** SHALL exit with code 0

#### Scenario: Missing rules are warned as audit-only

- **WHEN** reconciliation returns `missing` entries
- **THEN** the CLI SHALL warn about them as audit information
- **AND** SHALL NOT change the exit code on their account

#### Scenario: Warnings are suppressed under --json

- **WHEN** reconciliation returns mismatches and `--json` is set
- **THEN** stdout SHALL contain only the existing `{ success, results }` JSON shape
- **AND** SHALL NOT contain the human-readable mismatch warnings

### Requirement: Check degrades to a local scan when reconciliation cannot complete

`taskless check` SHALL NOT fail solely because an attempted reconciliation cannot complete. When a token is available and `--anonymous` is not set but reconciliation cannot complete (no resolvable git remote, or the reconcile endpoint is unreachable or not yet deployed, or a transport error), the CLI SHALL warn that rule verification could not be performed and SHALL fall back to scanning all local rule files. The CLI SHALL NOT exit with a non-zero code solely because reconciliation failed, and the warning SHALL be suppressed under `--json`.

#### Scenario: Endpoint unreachable degrades to local scan

- **WHEN** an authenticated `check` attempts reconciliation and the endpoint is unreachable or returns a not-deployed error
- **THEN** the CLI SHALL warn that verification could not be performed
- **AND** SHALL scan all local rule files
- **AND** SHALL NOT exit with a non-zero code solely due to the reconcile failure

#### Scenario: Degrade warning is suppressed under --json

- **WHEN** the CLI degrades to a local scan and `--json` is set
- **THEN** stdout SHALL contain only the existing `{ success, results }` JSON shape
- **AND** SHALL NOT contain the human-readable degrade warning

### Requirement: Check exits cleanly when the run set is empty

`taskless check` SHALL NOT invoke the scanner when a successful reconciliation returns an empty `run` set (for example an empty corpus, or every reported file classified `unsafe`/`unknown`); it SHALL report no scan results and SHALL exit with code 0. Any `unsafe` / `unknown` mismatch warnings SHALL still be emitted.

#### Scenario: Empty run set skips the scan

- **WHEN** reconciliation returns an empty `run` set
- **THEN** the CLI SHALL NOT invoke `sg scan`
- **AND** SHALL exit with code 0
- **AND** SHALL still warn about any `unsafe`/`unknown` mismatches
