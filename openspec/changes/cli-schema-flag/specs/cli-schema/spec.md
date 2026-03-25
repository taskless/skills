## ADDED Requirements

### Requirement: Zod schemas define CLI I/O contracts

Each CLI command that supports `--json` SHALL have Zod schemas defined in `packages/cli/src/schemas/` that describe:

- Input schema (for commands accepting `--from` JSON)
- Output schema (the success `--json` shape)
- Error schema (the failure `--json` shape)

These Zod schemas SHALL be the single source of truth for validation and schema generation.

#### Scenario: rules create has input, output, and error schemas

- **WHEN** inspecting `packages/cli/src/schemas/rules-create.ts`
- **THEN** it SHALL export `inputSchema`, `outputSchema`, and `errorSchema` as Zod objects

#### Scenario: rules improve has input, output, and error schemas

- **WHEN** inspecting `packages/cli/src/schemas/rules-improve.ts`
- **THEN** it SHALL export `inputSchema`, `outputSchema`, and `errorSchema` as Zod objects

#### Scenario: check has output and error schemas only

- **WHEN** inspecting `packages/cli/src/schemas/check.ts`
- **THEN** it SHALL export `outputSchema` and `errorSchema` as Zod objects
- **AND** it SHALL NOT export `inputSchema`

#### Scenario: update-engine has output and error schemas only

- **WHEN** inspecting `packages/cli/src/schemas/update-engine.ts`
- **THEN** it SHALL export `outputSchema` and `errorSchema` as Zod objects
- **AND** it SHALL NOT export `inputSchema`

### Requirement: Input schemas match --from JSON shapes

The input Zod schema for each command SHALL describe exactly the JSON shape the agent writes to the `--from` file. It SHALL NOT include fields the CLI fills in from project config (e.g., `orgId`, `repositoryUrl`).

#### Scenario: rules create input schema

- **WHEN** the `inputSchema` from `rules-create.ts` is inspected
- **THEN** it SHALL require `prompt` (string) and optionally accept `successCases` (string array) and `failureCases` (string array)
- **AND** it SHALL NOT include `orgId` or `repositoryUrl`

#### Scenario: rules improve input schema

- **WHEN** the `inputSchema` from `rules-improve.ts` is inspected
- **THEN** it SHALL require `ruleId` (string) and `guidance` (string), and optionally accept `references` (array of `{ filename: string, content: string }`)

### Requirement: Output schemas match --json success shapes

The output Zod schema for each command SHALL describe the JSON object written to stdout when the command succeeds with `--json`.

#### Scenario: rules create output schema

- **WHEN** the `outputSchema` from `rules-create.ts` is inspected
- **THEN** it SHALL describe `{ success: true, ruleId: string, rules: string[], files: string[] }`

#### Scenario: rules improve output schema

- **WHEN** the `outputSchema` from `rules-improve.ts` is inspected
- **THEN** it SHALL describe `{ success: true, requestId: string, rules: string[], files: string[] }`

#### Scenario: check output schema

- **WHEN** the `outputSchema` from `check.ts` is inspected
- **THEN** it SHALL describe `{ success: boolean, results: CheckResult[] }` where CheckResult includes `source`, `ruleId`, `severity`, `message`, `file`, `range`, `matchedText`, and optional `note` and `fix`

#### Scenario: update-engine output schema

- **WHEN** the `outputSchema` from `update-engine.ts` is inspected
- **THEN** it SHALL describe the union of status shapes: `{ status: "current" }`, `{ status: "exists", requestId, prUrl }`, `{ status: "open", prUrl }`, `{ status: "merged", prUrl }`, `{ status: "closed", prUrl }`

### Requirement: Error schemas match --json failure shapes

The error Zod schema for each command SHALL describe the JSON object written to stdout when the command fails with `--json` and a non-zero exit code.

#### Scenario: check error schema

- **WHEN** the `errorSchema` from `check.ts` is inspected
- **THEN** it SHALL describe `{ success: false, error: string, results: CheckResult[] }`

#### Scenario: rules create error schema

- **WHEN** the `errorSchema` from `rules-create.ts` is inspected
- **THEN** it SHALL describe `{ error: string }`

#### Scenario: update-engine error schema

- **WHEN** the `errorSchema` from `update-engine.ts` is inspected
- **THEN** it SHALL describe `{ error: string }`

### Requirement: --schema short-circuits command execution

When `--schema` is passed, the command SHALL print schema information to stdout and exit with code 0. No authentication, configuration reading, network requests, or other side effects SHALL occur.

#### Scenario: --schema on rules create requires no auth

- **WHEN** a user runs `taskless rules create --schema` without being authenticated
- **THEN** the CLI SHALL print the schema blocks and exit 0
- **AND** SHALL NOT attempt to read a token or project config

#### Scenario: --schema on check requires no .taskless directory

- **WHEN** a user runs `taskless check --schema` in a directory without `.taskless/`
- **THEN** the CLI SHALL print the schema blocks and exit 0

#### Scenario: --schema ignores other flags

- **WHEN** a user runs `taskless rules create --schema --from request.json`
- **THEN** the CLI SHALL print schema blocks and exit 0
- **AND** SHALL NOT read or process the `--from` file

### Requirement: --schema output format

When `--schema` is passed, the CLI SHALL output three labeled sections to stdout. Each section SHALL have a label line followed by either a valid JSON Schema object or a descriptive message.

#### Scenario: Command with input, output, and error schemas

- **WHEN** a user runs `taskless rules create --schema`
- **THEN** stdout SHALL contain:
  - A line `Input Schema:` followed by a JSON Schema object
  - A blank line separator
  - A line `Output Schema:` followed by a JSON Schema object
  - A blank line separator
  - A line `Error Schema:` followed by a JSON Schema object

#### Scenario: Command with no input schema

- **WHEN** a user runs `taskless check --schema`
- **THEN** the `Input Schema:` section SHALL read `This command does not accept JSON input.`
- **AND** the `Output Schema:` and `Error Schema:` sections SHALL contain JSON Schema objects

### Requirement: JSON Schema generation uses zod-to-json-schema

The `--schema` output SHALL be generated by converting Zod schemas to JSON Schema format using the `zod-to-json-schema` library.

#### Scenario: Output is valid JSON Schema

- **WHEN** a user runs `taskless rules create --schema`
- **THEN** each JSON block in the output SHALL be a valid JSON Schema document parseable by `JSON.parse()`

### Requirement: --from input validated via Zod

Commands that accept `--from` JSON input SHALL validate the parsed JSON using the corresponding Zod input schema's `.parse()` method, replacing manual `typeof` checks.

#### Scenario: rules create validates input with Zod

- **WHEN** a user runs `taskless rules create --from request.json`
- **AND** the file contains `{ "prompt": 123 }` (wrong type)
- **THEN** the CLI SHALL fail with a Zod validation error message

#### Scenario: rules improve validates input with Zod

- **WHEN** a user runs `taskless rules improve --from request.json`
- **AND** the file is missing the required `guidance` field
- **THEN** the CLI SHALL fail with a Zod validation error message

### Requirement: --json output validated via Zod

Commands that support `--json` SHALL pass their output through the corresponding Zod output schema's `.parse()` method before serializing with `JSON.stringify`.

#### Scenario: Output validation catches shape drift

- **WHEN** a command constructs a `--json` output object that is missing a required field
- **THEN** the Zod `.parse()` call SHALL throw, preventing malformed output from reaching stdout
