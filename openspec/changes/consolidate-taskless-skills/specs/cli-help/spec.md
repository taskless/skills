# CLI Help

## MODIFIED Requirements

### Requirement: Help subcommand displays rich help text for commands

The CLI SHALL support a `help` subcommand that accepts zero or more positional arguments identifying a topic path AND an optional `--anonymous` boolean flag. When positional arguments are provided, the help subcommand SHALL look up a matching help text file embedded at build time using the following resolution order:

1. If `--anonymous` is set AND `<topic>.anonymous.txt` exists in the embedded map, return that file.
2. Otherwise, return `<topic>.txt`.
3. If neither exists, exit with code 1 and an error message suggesting `taskless help` for the topic index.

When no positional arguments are provided, the help subcommand SHALL print a topic index containing a one-paragraph human slug followed by a topic disambiguation table mapping topic names to their summaries.

#### Scenario: Help for a topic returns the recipe

- **WHEN** a user runs `taskless help check`
- **THEN** the CLI SHALL print the contents of `check.txt` to stdout

#### Scenario: Help for a nested topic joins with hyphens

- **WHEN** a user runs `taskless help rule create`
- **THEN** the CLI SHALL look up `rule-create.txt` and print its contents

#### Scenario: Help with --anonymous returns the variant when present

- **WHEN** a user runs `taskless help rule create --anonymous`
- **AND** `rule-create.anonymous.txt` exists in the embedded help map
- **THEN** the CLI SHALL print the contents of `rule-create.anonymous.txt`

#### Scenario: Help with --anonymous falls back when no variant exists

- **WHEN** a user runs `taskless help check --anonymous`
- **AND** no `check.anonymous.txt` exists
- **THEN** the CLI SHALL print the contents of `check.txt` (no error, no warning — anonymous is a no-op for this topic)

#### Scenario: Help with no arguments shows index with human slug and disambiguation table

- **WHEN** a user runs `taskless help`
- **THEN** the CLI SHALL print a one-paragraph human-facing slug explaining what the help command does for human vs. agent audiences
- **AND** SHALL print a topic table mapping each topic name to its one-line summary
- **AND** SHALL include a note about the `--anonymous` flag

#### Scenario: Help for an unknown topic exits with error

- **WHEN** a user runs `taskless help nonexistent`
- **THEN** the CLI SHALL print an error message indicating the topic is not recognized
- **AND** exit with code 1

### Requirement: Help text files follow a consistent format

Every help text file at `packages/cli/src/help/<topic>.txt` SHALL follow the canonical recipe template:

```
# Topic: <name>     (CLI v<x.y.z> / topic v<n>)

## Goal
<one paragraph stating what this recipe accomplishes>

## Preconditions
<bulleted list of state required before running, including auth state>

## Steps
<numbered list of agent-facing steps>

## Input schema
<for recipes that take a --from input: a code-fenced JSON Schema block
 generated from the corresponding Zod schema via zod-to-json-schema>

## Errors
<table mapping error code to user-facing fix>

## See Also
<bulleted list of related topics>
```

The header line SHALL include the CLI version (interpolated at build time) and a topic version integer maintained by the recipe author and bumped when the recipe changes meaningfully.

#### Scenario: Recipe contains all template sections

- **WHEN** any `<topic>.txt` file is read
- **THEN** it SHALL begin with the `# Topic: <name> (CLI v<x.y.z> / topic v<n>)` header
- **AND** SHALL contain `## Goal`, `## Preconditions`, `## Steps`, `## Errors`, and `## See Also` sections in that order

#### Scenario: Recipe with --from input includes JSON schema

- **WHEN** a topic recipe documents a CLI invocation that uses `--from <file>`
- **THEN** the recipe SHALL contain an `## Input schema` section with a code-fenced JSON Schema block
- **AND** the JSON Schema SHALL be derived from the corresponding Zod schema in `packages/cli/src/schemas/`

#### Scenario: Header version reflects build-time CLI version

- **WHEN** the CLI bundle is built
- **THEN** the recipe header's CLI version SHALL be interpolated at build time from `packages/cli/package.json`
- **AND** SHALL match the version reported by `taskless info`

## ADDED Requirements

### Requirement: Anonymous variant lookup uses a compile-time map

The help command SHALL construct, at build time, a Set of topic names that have a corresponding `<topic>.anonymous.txt` file. Lookup at runtime SHALL be O(1). The Set SHALL be derived from `import.meta.glob` matching `*.anonymous.txt` in the help directory.

#### Scenario: Topics with variants are detected at build time

- **WHEN** the CLI bundle is built
- **AND** files `rule-create.anonymous.txt` and `rule-improve.anonymous.txt` exist
- **THEN** the embedded variants set SHALL contain `rule-create` and `rule-improve`

#### Scenario: Topics without variants are absent from the map

- **WHEN** the CLI bundle is built
- **AND** no `check.anonymous.txt` file exists
- **THEN** the embedded variants set SHALL NOT contain `check`
- **AND** `taskless help check --anonymous` SHALL fall back to `check.txt`

### Requirement: Embedded JSON schemas are generated via zod-to-json-schema

For every recipe topic that documents a CLI command accepting `--from <file>`, the corresponding Zod input schema in `packages/cli/src/schemas/` SHALL be converted to JSON Schema via `zod-to-json-schema` and embedded in the recipe's `## Input schema` section as a fenced code block. Generation MAY happen at runtime (small dep, fast) or at build time; runtime is acceptable.

#### Scenario: rule create recipe embeds input schema

- **WHEN** a user runs `taskless help rule create`
- **THEN** the output SHALL contain an `## Input schema` section
- **AND** the section SHALL contain a code-fenced JSON Schema block derived from the `rules-create` Zod schema (or the renamed `rule-create` schema)

#### Scenario: rule improve recipe embeds input schema

- **WHEN** a user runs `taskless help rule improve`
- **THEN** the output SHALL contain an `## Input schema` section with the rule-improve JSON Schema

### Requirement: Help command emits intent telemetry

The help command SHALL emit a PostHog event on every invocation:

- `help_<topic>` (e.g. `help_rule_create`, `help_check`, `help_auth`) when called with positional arguments resolving to a known topic
- `help_index` when called with no positional arguments
- `help_unknown` (with the attempted topic as a property) when called with positional arguments resolving to no topic

These events SHALL replace the previous `cli_help_<topic>` events in a single hard rename.

#### Scenario: Topic fetch emits intent event

- **WHEN** an agent runs `taskless help rule create`
- **THEN** PostHog SHALL receive a `help_rule_create` event

#### Scenario: Index fetch emits help_index

- **WHEN** an agent runs `taskless help` (no args)
- **THEN** PostHog SHALL receive a `help_index` event
