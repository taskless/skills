# CLI Rules

## MODIFIED Requirements

### Requirement: Rules subcommand group exists

The CLI SHALL expose the rule operations under the `rule` (singular) subcommand group. The user-facing surface SHALL be `taskless rule create`, `taskless rule improve`, `taskless rule delete`, `taskless rule verify`, and `taskless rule meta`. The internal source filename (`packages/cli/src/commands/rules.ts`) MAY remain plural — only the user-visible subcommand name changes.

The previous plural form `taskless rules <subcommand>` SHALL NOT work in v0.7.0 — there is no compatibility alias.

#### Scenario: Singular subcommand registers correctly

- **WHEN** a user runs `taskless rule create --from req.json`
- **THEN** the CLI SHALL invoke the rule-create handler

#### Scenario: Plural subcommand is no longer recognized

- **WHEN** a user runs `taskless rules create --from req.json`
- **THEN** the CLI SHALL exit with an error indicating the subcommand is unknown
- **AND** the error message SHOULD suggest `taskless rule create`

### Requirement: Rules create reads request from stdin

The `taskless rule create` command SHALL accept a `--from <file>` flag specifying a JSON file containing the rule request. (Note: previously named `rules create`; renamed to singular.)

#### Scenario: rule create with --from file

- **WHEN** a user runs `taskless rule create --from .taskless/.tmp-rule-request.json --json`
- **THEN** the CLI SHALL read the JSON file and submit it to the API

### Requirement: Rules create resolves identity from JWT and git remote

`taskless rule create` resolves user identity from the stored JWT and the git remote per the existing identity resolution requirements. (Renamed to singular.)

### Requirement: Rules create requires authentication

`taskless rule create` SHALL require authentication unless the new `--anonymous` flag is set. When `--anonymous` is set, the command SHALL invoke the local-only flow (see "Rule create supports anonymous local-only flow" below) instead of submitting to the API. (Renamed to singular; new anonymous branch.)

#### Scenario: rule create without --anonymous requires auth

- **WHEN** a user runs `taskless rule create --from req.json` without being logged in
- **THEN** the CLI SHALL exit with code 1 and an `AUTH_REQUIRED` error

#### Scenario: rule create --anonymous skips auth

- **WHEN** a user runs `taskless rule create --from req.json --anonymous` without being logged in
- **THEN** the CLI SHALL invoke the local-only flow without checking auth

### Requirement: Rules create submits to API and polls for results

`taskless rule create` (without `--anonymous`) submits to the API and polls per the existing requirement. (Renamed to singular.)

### Requirement: Rules create writes rule files to disk

`taskless rule create` SHALL write the generated rule file to `.taskless/rules/<id>.yml` regardless of whether `--anonymous` was set. The agent invoking the command SHALL NOT be expected to write rule files itself. (Renamed to singular; this strengthens the existing requirement to apply to both branches.)

#### Scenario: Both branches write rule files

- **WHEN** `taskless rule create` succeeds (with or without `--anonymous`)
- **THEN** `.taskless/rules/<id>.yml` SHALL exist on disk

### Requirement: Rules create writes test files to disk

`taskless rule create` SHALL write generated test files to `.taskless/rule-tests/<id>.yml` regardless of whether `--anonymous` was set. (Renamed; strengthened.)

### Requirement: Rules create outputs results

`taskless rule create` outputs results per the existing requirement. (Renamed to singular.) Output SHALL be human-readable by default; `--json` produces machine-readable output. On failure with `--json` set, the output SHALL be the standardized error envelope `{ ok: false, code: "<CODE>", message: "<...>" }` per the `cli` capability requirements.

### Requirement: Rules create shows progress during polling

`taskless rule create` shows progress per the existing requirement when polling the API (the `--anonymous` branch does not poll an API and SHOULD show progress for the local agent-driven steps if applicable). (Renamed to singular.)

### Requirement: Rules improve reads request from file

`taskless rule improve` SHALL accept a `--from <file>` flag specifying a JSON file containing the iterate request. (Renamed to singular.)

### Requirement: Rules improve requires authentication

`taskless rule improve` SHALL require authentication unless `--anonymous` is set. (Renamed; new anonymous branch.)

### Requirement: Rules improve submits to iterate API and polls for results

`taskless rule improve` (without `--anonymous`) submits and polls per the existing requirement. (Renamed.)

### Requirement: Rules improve writes updated files to disk

`taskless rule improve` SHALL write updated rule files to disk in both branches. (Renamed; strengthened.)

### Requirement: Rules improve outputs results

`taskless rule improve` outputs results per the existing requirement. (Renamed.) Failure output with `--json` SHALL use the standardized error envelope.

### Requirement: Rules improve has a help entry

`taskless help rule improve` SHALL return the recipe per `cli-help` requirements. (Renamed; the help filename becomes `rule-improve.txt` with an optional `rule-improve.anonymous.txt` variant.)

### Requirement: Rules delete removes rule and test files

`taskless rule delete <id>` SHALL remove the corresponding rule file and any test files. (Renamed.) Accepts `--anonymous` as a no-op.

### Requirement: Rules delete does not require authentication

`taskless rule delete` does not require authentication per the existing requirement. (Renamed.)

### Requirement: Rules delete accepts the id argument

`taskless rule delete <id>` accepts the rule ID as a positional argument per the existing requirement. (Renamed.)

### Requirement: Verify subcommand validates rules against ast-grep schema

`taskless rule verify` SHALL validate rules against the ast-grep schema per the existing requirement. (Renamed from `rules verify` to `rule verify`.) Accepts `--anonymous` as a no-op.

### Requirement: Verify performs three layers of validation

`taskless rule verify` performs the three layers of validation per the existing requirement. (Renamed.)

### Requirement: Verify supports JSON output

`taskless rule verify --json` outputs results in the documented JSON shape. On failure, the standardized error envelope is used. (Renamed.)

### Requirement: Verify schema mode dumps combined schema for agent consumption

The `taskless rule verify --schema` mode is REMOVED in v0.7.0 — schemas are now embedded in `tskl help rule create` recipe output via `zod-to-json-schema`. (Renamed and superseded.)

#### Scenario: --schema flag is no longer accepted

- **WHEN** a user runs `taskless rule verify --schema`
- **THEN** the CLI SHALL exit with an error indicating the flag is unknown

### Requirement: Verify respects global flags

`taskless rule verify` respects global flags including `--dir` per the existing requirement. (Renamed.) Also accepts the new `--anonymous` flag as a no-op.

## ADDED Requirements

### Requirement: Rule create supports anonymous local-only flow

When `taskless rule create --anonymous` is invoked, the CLI SHALL execute the local-only rule-creation flow (previously implemented as the `taskless-create-rule-anonymous` skill body). The flow SHALL:

1. NOT submit any request to the Taskless API
2. Generate the ast-grep rule using local logic (Claude SDK, agent-driven generation, or whatever the migrated implementation prefers — see design.md)
3. Write the rule file to `.taskless/rules/<id>.yml`
4. Write any generated test files to `.taskless/rule-tests/<id>.yml`
5. NOT write a metadata sidecar (the API-backed branch does)
6. Return the same output format as the API-backed branch (paths to created files)

#### Scenario: rule create --anonymous skips API

- **WHEN** a user runs `taskless rule create --from req.json --anonymous`
- **THEN** the CLI SHALL NOT make any HTTP request to the Taskless API
- **AND** SHALL produce a rule file under `.taskless/rules/`

#### Scenario: rule create --anonymous produces no metadata sidecar

- **WHEN** `taskless rule create --anonymous` succeeds
- **THEN** no file under `.taskless/rule-metadata/` SHALL be written for the new rule

### Requirement: Rule improve supports anonymous local-only flow

When `taskless rule improve --anonymous` is invoked, the CLI SHALL execute the local-only rule-improvement flow (previously implemented as the `taskless-improve-rule-anonymous` skill body). The flow SHALL:

1. NOT submit any request to the Taskless API iterate endpoint
2. Update the rule file in place using local logic
3. Support the verify feedback loop by exposing the `rule verify` primitive that the agent invokes between edits
4. Return the same output format as the API-backed branch

#### Scenario: rule improve --anonymous skips API

- **WHEN** a user runs `taskless rule improve --from iterate.json --anonymous`
- **THEN** the CLI SHALL NOT make any HTTP request to the Taskless API
- **AND** SHALL update the target rule file
