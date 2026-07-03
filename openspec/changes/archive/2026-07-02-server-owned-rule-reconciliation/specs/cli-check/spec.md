## ADDED Requirements

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

## MODIFIED Requirements

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
