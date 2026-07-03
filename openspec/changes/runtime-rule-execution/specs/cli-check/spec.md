## ADDED Requirements

### Requirement: Check dispatches static and runtime rules to distinct executors

`taskless check` SHALL execute **static** ast-grep rules under `.taskless/rules/` with the
ast-grep scanner as before, and **runtime** rules under `.taskless/runtime-rules/` (directories
with `metadata.taskless.kind: runtime`, per the `cli-runtime-rule-execution` capability) with
the runtime harness. Findings from both executors SHALL be aggregated into the same result set
and SHALL count toward the exit code identically.

#### Scenario: Mixed corpus runs both executors

- **WHEN** `.taskless/rules/` contains static rules and `.taskless/runtime-rules/` contains runtime rules
- **THEN** the CLI SHALL run static rules through `sg scan` and runtime rules through the runtime harness
- **AND** SHALL merge their findings into one result set

### Requirement: Check runs runtime rules only on a signature-validated path

`taskless check` SHALL execute a runtime rule's `check.ts` only when that `check.ts` has been
validated by the server — returned in the reconciliation `run` set — or when
`--dangerously-run-scripts` is set. When a token is available and `--anonymous` is not set, the
CLI SHALL reconcile and execute every runtime rule whose `check.ts` is in `run`. An API key
SHALL be treated identically to an interactive token. On any path where the runtime rule's
`check.ts` signature is not validated — logged out, `--anonymous`, or a reconciliation that
cannot complete — the CLI SHALL NOT execute the rule's `check.ts`.

#### Scenario: Authenticated check runs blessed runtime rules

- **WHEN** an authenticated `check` reconciles and a runtime rule's `check.ts` is returned in `run`
- **THEN** the CLI SHALL execute that runtime rule through the harness

#### Scenario: A rule whose check.ts is not blessed is withheld

- **WHEN** reconciliation does not return a runtime rule's `check.ts` in `run` (it lands in `unsafe`/`unknown`/`missing`)
- **THEN** the CLI SHALL NOT execute that runtime rule
- **AND** SHALL surface it as an advisory mismatch

#### Scenario: API key behaves like a token

- **WHEN** `check` runs with an API key
- **THEN** the CLI SHALL reconcile and run validated runtime rules exactly as with an interactive token

### Requirement: Check skips runtime rules on unverified paths and reports the skip

`taskless check` SHALL skip a runtime rule's execution when it cannot validate the rule's
signature — logged out, `--anonymous`, or reconciliation cannot complete — and
`--dangerously-run-scripts` is not set. It SHALL report that runtime rules exist and were not
run, SHALL still run static rules on these paths, and SHALL NOT change the exit code because
rules were skipped. In human output the report SHALL be a notice; under `--json` it SHALL be an
additive, optional `skipped` array of `{ rule, reason }`, leaving the existing `success` and
`results` fields unchanged, so machine callers (for example CI) can detect that runtime rules
did not run.

#### Scenario: Logged-out check skips runtime rules

- **WHEN** a user runs `taskless check` with no available token and runtime rules are present
- **THEN** the CLI SHALL run static rules
- **AND** SHALL NOT execute any runtime rule's `check.ts`
- **AND** SHALL report that the runtime rules were skipped
- **AND** SHALL NOT change the exit code because rules were skipped

#### Scenario: Skipped runtime rules appear under --json

- **WHEN** runtime rules are skipped and `--json` is set
- **THEN** stdout SHALL include a `skipped` array of `{ rule, reason }` alongside the unchanged `success` and `results` fields

#### Scenario: Anonymous skips runtime rules while authenticated

- **WHEN** a user runs `taskless check --anonymous` while a token is available
- **THEN** the CLI SHALL skip runtime rules exactly as an unauthenticated `check`

### Requirement: Check accepts --dangerously-run-scripts to run runtime rules without server validation

`taskless check` SHALL accept a `--dangerously-run-scripts` flag that runs **all** runtime
rules by trusting their local signatures without server validation, regardless of auth state.
When the flag is set the CLI SHALL NOT reconcile — it SHALL skip the network entirely (matching
how `--anonymous` forces the no-network path) and execute every present runtime rule. The CLI
SHALL emit a prominent warning that runtime rule code is being executed unverified. The flag
SHALL be the only way to execute runtime rules on an unverified path.

#### Scenario: Dangerously-run-scripts executes runtime rules offline

- **WHEN** a user runs `taskless check --dangerously-run-scripts` with no available token
- **THEN** the CLI SHALL execute the present runtime rules' `check.ts`
- **AND** SHALL emit a warning that runtime rule code ran unverified

#### Scenario: Warning is suppressed under --json

- **WHEN** `--dangerously-run-scripts` and `--json` are both set
- **THEN** stdout SHALL contain only the existing `{ success, results }` JSON shape
- **AND** the unverified-execution warning SHALL NOT appear in stdout

## MODIFIED Requirements

### Requirement: Check selects what it runs from auth state

`taskless check` SHALL NOT require authentication, and it SHALL choose what it runs from the
current auth state. **Static ast-grep rules** (single `*.yml` files under `.taskless/rules/`)
SHALL always run without contacting the server, on every path (the offline linter posture).
**Runtime rules** (directories with `metadata.taskless.kind: runtime`) SHALL run only on a
signature-validated path: when a token is available and `--anonymous` is not set the CLI SHALL
reconcile and execute the runtime rules fully returned in `run`; when no token is available,
when `--anonymous` is set, or when reconciliation cannot complete, the CLI SHALL skip runtime
execution unless `--dangerously-run-scripts` is set. The unauthenticated path SHALL succeed
with no network access for static rules and SHALL NOT emit a warning about missing
authentication.

#### Scenario: Unauthenticated check runs static rules and skips runtime rules

- **WHEN** a user runs `taskless check` with no available token
- **THEN** the CLI SHALL scan all static rule files
- **AND** SHALL NOT call `POST /cli/api/reconcile` for the purpose of running static rules
- **AND** SHALL skip runtime rules
- **AND** SHALL NOT emit a warning about missing authentication

#### Scenario: Authenticated check reconciles runtime rules

- **WHEN** a user runs `taskless check` with an available token and without `--anonymous`
- **THEN** the CLI SHALL reconcile and execute the runtime rules fully returned in `run`
- **AND** SHALL run static rules unconditionally

#### Scenario: Anonymous forces the logged-out path

- **WHEN** a user runs `taskless check --anonymous` while a token is available
- **THEN** the CLI SHALL behave exactly as an unauthenticated `check` (static rules run, runtime rules skipped, no reconcile call)

### Requirement: Check reconciles rule files before scanning

`taskless check` SHALL reconcile before running runtime rules whenever a bearer token and a
`repositoryUrl` are resolvable and `--anonymous` is not set. It SHALL compute the signature
envelope for the `check.ts` of every runtime rule under `.taskless/runtime-rules/`, call
`POST /cli/api/reconcile` with `{ repositoryUrl, files }`, and then execute **only** the
runtime rules whose `check.ts` is returned in the `run` set, matched back to local files by
signature (per the `cli-rule-reconciliation` capability). Capture `*.yml` and static rules
SHALL NOT be gated by reconciliation.

#### Scenario: Only rules with a blessed check.ts execute

- **WHEN** a user runs `taskless check` while authenticated and reconciliation returns a `run`
  set covering the `check.ts` of some runtime rules and not others
- **THEN** the CLI SHALL execute only the runtime rules whose `check.ts` is in `run`
- **AND** SHALL run all static rules regardless of the `run` set

### Requirement: Check degrades to a local scan when reconciliation cannot complete

`taskless check` SHALL NOT fail solely because an attempted reconciliation cannot complete.
When a token is available and `--anonymous` is not set but reconciliation cannot complete (no
resolvable git remote, or the reconcile endpoint is unreachable or not yet deployed, or a
transport error), the CLI SHALL warn that rule verification could not be performed, SHALL fall
back to scanning all **static** rule files, and SHALL **skip runtime rules** (their `check.ts`
SHALL NOT run) unless `--dangerously-run-scripts` is set. The CLI SHALL NOT exit with a
non-zero code solely because reconciliation failed, and the warning SHALL be suppressed under
`--json`.

#### Scenario: Endpoint unreachable degrades static and skips runtime

- **WHEN** an authenticated `check` attempts reconciliation and the endpoint is unreachable or returns a not-deployed error
- **THEN** the CLI SHALL warn that verification could not be performed
- **AND** SHALL scan all static rule files
- **AND** SHALL NOT execute any runtime rule's `check.ts`
- **AND** SHALL NOT exit with a non-zero code solely due to the reconcile failure

#### Scenario: Degrade warning is suppressed under --json

- **WHEN** the CLI degrades and `--json` is set
- **THEN** stdout SHALL contain only the existing `{ success, results }` JSON shape
- **AND** SHALL NOT contain the human-readable degrade warning
