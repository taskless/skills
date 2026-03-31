## ADDED Requirements

### Requirement: Build-time codegen fetches official ast-grep rule schema

The CLI build pipeline SHALL include a codegen step that fetches the official ast-grep rule JSON Schema from GitHub and stores it as a generated artifact. The schema version SHALL be pinned to the `@ast-grep/cli` version specified in `packages/cli/package.json`.

#### Scenario: Codegen fetches schema from GitHub

- **WHEN** the codegen script is executed
- **THEN** it SHALL fetch `https://raw.githubusercontent.com/ast-grep/ast-grep/{VERSION}/schemas/rule.json` where `{VERSION}` is the `@ast-grep/cli` version from `packages/cli/package.json`
- **AND** write the result to `packages/cli/src/generated/ast-grep-rule-schema.json`

#### Scenario: Generated schema includes metadata comment

- **WHEN** the schema file is generated
- **THEN** it SHALL include a `$comment` field with the generation timestamp, ast-grep version, and source URL

#### Scenario: Generated schema is committed to git

- **WHEN** the codegen script completes
- **THEN** the generated file SHALL be committed to the repository alongside other generated artifacts in `packages/cli/src/generated/`

### Requirement: Schema version is pinned to ast-grep dependency

The codegen script SHALL extract the ast-grep version from `packages/cli/package.json` dependencies. The version extraction SHALL handle semver range prefixes (e.g., `^0.41.0` resolves to `0.41.0`).

#### Scenario: Version extracted from package.json

- **WHEN** `packages/cli/package.json` has `"@ast-grep/cli": "^0.41.0"` in dependencies
- **THEN** the codegen script SHALL fetch the schema for version `0.41.0`

#### Scenario: Codegen fails gracefully on network error

- **WHEN** the GitHub fetch fails (network error, 404, etc.)
- **THEN** the codegen script SHALL exit with a non-zero code and a descriptive error message
- **AND** SHALL NOT overwrite an existing generated schema file

### Requirement: Generated schema is importable at build time

The generated JSON Schema file SHALL be importable by the CLI bundle via Vite. The import SHALL make the full JSON Schema object available at runtime without filesystem reads or network fetches.

#### Scenario: Schema imported in verify command

- **WHEN** the `rules verify` command needs the ast-grep schema
- **THEN** it SHALL import the schema from `../generated/ast-grep-rule-schema.json`
- **AND** the schema object SHALL be available synchronously at runtime

### Requirement: Verify subcommand validates rules against ast-grep schema

The CLI SHALL support a `taskless rules verify` subcommand that validates a rule file against the ast-grep Zod schema, applies Taskless-specific requirements, and runs test cases. The subcommand SHALL accept a positional `<id>` argument identifying the rule to verify.

#### Scenario: Verify a valid rule with passing tests

- **WHEN** a user runs `taskless rules verify no-eval`
- **THEN** the CLI SHALL read `.taskless/rules/no-eval.yml`
- **AND** validate it against the ast-grep Zod schema
- **AND** check Taskless-specific requirements
- **AND** run `sg test` for the rule's test cases
- **AND** report success with a summary of checks passed

#### Scenario: Verify a rule that fails schema validation

- **WHEN** a user runs `taskless rules verify bad-rule` and the rule YAML contains unknown fields or invalid types
- **THEN** the CLI SHALL report the specific schema validation errors
- **AND** exit with code 1

#### Scenario: Verify a rule with no test file

- **WHEN** a user runs `taskless rules verify orphan-rule` and no matching test file exists in `.taskless/rule-tests/`
- **THEN** the CLI SHALL report a Taskless requirement failure: missing test file
- **AND** skip the test execution layer

#### Scenario: Verify a nonexistent rule

- **WHEN** a user runs `taskless rules verify nonexistent`
- **THEN** the CLI SHALL report that `.taskless/rules/nonexistent.yml` was not found
- **AND** exit with code 1

### Requirement: Verify performs three layers of validation

The verify subcommand SHALL execute validation in three sequential layers: (1) Zod schema validation against the ast-grep rule schema, (2) Taskless requirement checks, and (3) test execution via `sg test`. If an earlier layer fails, subsequent layers SHALL still execute to provide complete feedback.

#### Scenario: Layer 1 — Schema validation

- **WHEN** the rule file is parsed as YAML
- **THEN** the CLI SHALL validate the resulting object against the ast-grep Zod schema
- **AND** report all validation errors with field paths

#### Scenario: Layer 2 — Taskless requirement checks

- **WHEN** the rule passes or fails schema validation
- **THEN** the CLI SHALL additionally check that `id`, `language`, `severity`, `message`, and `rule` fields are present
- **AND** check that any rule using `regex` also specifies `kind` at the same level
- **AND** check that a matching test file exists in `.taskless/rule-tests/`

#### Scenario: Layer 3 — Test execution via sg test

- **WHEN** a matching test file exists
- **THEN** the CLI SHALL generate `sgconfig.yml` via `generateSgConfig()`
- **AND** run `sg test --config .taskless/sgconfig.yml` using the existing `findSgBinary()` resolver
- **AND** parse the output to report pass/fail counts for valid and invalid test cases

#### Scenario: All layers run regardless of earlier failures

- **WHEN** Layer 1 reports schema errors
- **THEN** Layer 2 and Layer 3 SHALL still execute
- **AND** the output SHALL include results from all three layers

### Requirement: Verify supports JSON output

The verify subcommand SHALL support the global `--json` flag. When enabled, the output SHALL be a JSON object with per-layer results.

#### Scenario: JSON output for successful verification

- **WHEN** a user runs `taskless rules verify no-eval --json`
- **THEN** the CLI SHALL output a JSON object with structure: `{ "success": true, "ruleId": "no-eval", "schema": { "valid": true, "errors": [] }, "requirements": { "valid": true, "checks": [...] }, "tests": { "valid": true, "passed": <n>, "failed": 0 } }`

#### Scenario: JSON output for failed verification

- **WHEN** a user runs `taskless rules verify bad-rule --json` and the rule fails Layer 2
- **THEN** the CLI SHALL output a JSON object with `"success": false` and the failing layer SHALL have `"valid": false` with descriptive error entries

### Requirement: Verify schema mode dumps combined schema for agent consumption

The verify subcommand SHALL support a `--schema` flag that dumps the combined ast-grep schema, Taskless requirements, and annotated examples as JSON. When `--schema` is provided, no rule ID is required and no validation is performed.

#### Scenario: Schema output with --schema flag

- **WHEN** a user runs `taskless rules verify --schema --json`
- **THEN** the CLI SHALL output a JSON object with three top-level keys: `astGrepSchema` (the full official ast-grep rule JSON Schema for agent reference), `tasklessRequirements` (required fields and additional rules), and `examples` (curated annotated rule examples)
- **AND** exit with code 0

#### Scenario: Schema output includes curated examples

- **WHEN** the `--schema` output is examined
- **THEN** the `examples` array SHALL include at least: a simple pattern match example, a regex-with-kind example, and a composite rule using `any`/`all`

#### Scenario: Schema flag does not require auth

- **WHEN** a user runs `taskless rules verify --schema` without being authenticated
- **THEN** the command SHALL succeed without requiring a token

### Requirement: Verify respects global flags

The verify subcommand SHALL respect the global `-d` (working directory) and `--schema` (print Zod schemas) flags consistent with other CLI subcommands.

#### Scenario: Verify uses custom directory

- **WHEN** a user runs `taskless rules verify no-eval -d /path/to/repo`
- **THEN** the CLI SHALL look for `.taskless/rules/no-eval.yml` in `/path/to/repo`

#### Scenario: Verify --schema prints Zod schemas

- **WHEN** a user runs `taskless rules verify --schema` (without `--json`)
- **THEN** the CLI SHALL print the combined schema payload in the standard `--schema` output format
