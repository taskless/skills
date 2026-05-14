## MODIFIED Requirements

### Requirement: Help text files follow a consistent format

Every help text file at `packages/cli/src/help/<topic>.txt` SHALL follow the canonical recipe template: a single-line header `# Topic: <name>     (CLI v%(CLI_VERSION)s / topic v<n>)`, followed by `## Goal`, `## Preconditions`, `## Steps`, optional `## Input schema` (for recipes that take `--from`), `## Errors`, and `## See Also` sections in that order. Recipe templates SHALL use sprintf-js `%(KEY)s` named-argument placeholders for all substitution. The header SHALL embed `%(CLI_VERSION)s` for the CLI version. Topics that document a `--from` input SHALL embed `%(INPUT_SCHEMA)s` inside the `## Input schema` fenced code block. The topic version integer in the header SHALL be a literal value maintained by the recipe author and bumped when the recipe changes meaningfully.

#### Scenario: Recipe contains all template sections

- **WHEN** any `<topic>.txt` file is read
- **THEN** it SHALL begin with a `# Topic:` header containing `%(CLI_VERSION)s` and the topic version integer
- **AND** SHALL contain `## Goal`, `## Preconditions`, `## Steps`, `## Errors`, and `## See Also` sections in that order

#### Scenario: Recipe with --from input includes JSON schema placeholder

- **WHEN** a topic recipe documents a CLI invocation that uses `--from <file>`
- **THEN** the recipe SHALL contain an `## Input schema` section with a code-fenced block containing the `%(INPUT_SCHEMA)s` placeholder
- **AND** the JSON Schema SHALL be derived at render time from the corresponding Zod schema in `packages/cli/src/schemas/`

#### Scenario: Header version reflects build-time CLI version

- **WHEN** the CLI bundle is built
- **THEN** the recipe header's `%(CLI_VERSION)s` placeholder SHALL be substituted at render time from `packages/cli/package.json`
- **AND** SHALL match the version reported by `taskless info`

## ADDED Requirements

### Requirement: Recipe substitution uses sprintf-js named arguments

Recipe rendering SHALL substitute placeholders via `sprintf-js` using its named-argument form (`%(KEY)s`). The renderer SHALL build a variables table for each render call containing two flavors of substitution:

1. **System-resolved values** — keys whose values come from runtime state. The renderer SHALL provide `CLI_VERSION` (resolved from the build-time version constant) for every render. The renderer SHALL provide `INPUT_SCHEMA` only when the recipe content contains the `%(INPUT_SCHEMA)s` placeholder; the value is the JSON Schema rendered from the topic's Zod schema in `packages/cli/src/schemas/`, or the literal string `"(no input schema for this topic)"` when no Zod schema is registered for the topic.
2. **Agent-fill markers** — keys whose values render as a lowercase angle-bracket token of the same name (e.g. `PACKAGE_MANAGER_DLX` renders as `<package-manager-dlx>`). The renderer SHALL provide `PACKAGE_MANAGER_DLX` for every render. Agent-fill markers exist so the consuming agent can substitute the value at execution time without the recipe having to invent a per-recipe placeholder convention.

Recipe authors SHALL escape any literal `%` character in recipe content as `%%` per sprintf-js conventions. The renderer SHALL NOT introduce any other placeholder syntax (`{{KEY}}`, `${KEY}`, etc.); all substitution SHALL flow through the sprintf-js named-argument table.

#### Scenario: CLI_VERSION substitutes the build-time version

- **WHEN** any recipe is rendered
- **THEN** every `%(CLI_VERSION)s` occurrence SHALL be replaced with the build-time CLI version

#### Scenario: INPUT_SCHEMA substitutes only when present in the recipe

- **WHEN** a recipe contains `%(INPUT_SCHEMA)s`
- **THEN** it SHALL be replaced with the JSON Schema rendered from the topic's Zod schema
- **AND** when no Zod schema is registered for the topic, the placeholder SHALL render as `(no input schema for this topic)`

#### Scenario: PACKAGE_MANAGER_DLX renders as an agent-fill marker

- **WHEN** any recipe contains `%(PACKAGE_MANAGER_DLX)s`
- **THEN** the rendered output SHALL contain the literal token `<package-manager-dlx>` at every occurrence

#### Scenario: No legacy placeholder syntax remains in recipes

- **WHEN** any `<topic>.txt` file under `packages/cli/src/help/` is read
- **THEN** it SHALL NOT contain a `{{KEY}}` mustache-style placeholder
- **AND** all substitution SHALL be expressed as `%(KEY)s` sprintf-js named arguments

### Requirement: onboard topic is registered in the help index

A new help topic `onboard` SHALL be registered. The CLI SHALL embed `packages/cli/src/help/onboard.txt` at build time via the existing `import.meta.glob` mechanism. `taskless help onboard` SHALL print the contents of `onboard.txt`. The topic SHALL appear in the output of `taskless help` (the index) with a one-line summary describing it as the post-install rule-discovery flow.

#### Scenario: Help for onboard returns the recipe

- **WHEN** a user runs `taskless help onboard`
- **THEN** the CLI SHALL print the contents of `onboard.txt` to stdout
- **AND** SHALL exit with code 0

#### Scenario: Help index includes onboard

- **WHEN** a user runs `taskless help` (no args)
- **THEN** the topic table SHALL include a row for `onboard`
- **AND** the row SHALL describe it as the post-install rule-discovery flow

#### Scenario: Onboard recipe is embedded at build time

- **WHEN** the CLI bundle is built
- **THEN** `import.meta.glob` matching the help directory SHALL include `onboard.txt`
- **AND** the recipe SHALL be available at runtime without filesystem access

#### Scenario: Help onboard with --anonymous falls back

- **WHEN** a user runs `taskless help onboard --anonymous`
- **AND** no `onboard.anonymous.txt` exists
- **THEN** the CLI SHALL print the contents of `onboard.txt` (anonymous is a no-op for this topic)

### Requirement: help_onboard intent telemetry

The help command's existing intent-telemetry requirement SHALL extend naturally to the new topic: invocations of `taskless help onboard` SHALL emit a `help_onboard` PostHog event, consistent with the `help_<topic>` pattern.

#### Scenario: Help onboard emits help_onboard

- **WHEN** an agent runs `taskless help onboard`
- **THEN** PostHog SHALL receive a `help_onboard` event
