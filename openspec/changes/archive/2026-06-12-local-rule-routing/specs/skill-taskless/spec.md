## MODIFIED Requirements

### Requirement: Skill description anchors triggers on Taskless-specific phrases

The consolidated skill's `description` frontmatter field SHALL anchor triggers on:

1. An explicit reference to "Taskless" in the user's message, OR
2. A reference to the `.taskless/` directory or files within it (rules, rule-tests, rule-metadata), OR
3. A request to add/write/create a rule for code, including requests that name a specific lint/format/static-analysis tool (for example eslint, ruff, biome, stylelint, ast-grep). Naming such a tool SHALL engage the skill's routing flow rather than suppress it; the skill routes the request toward the appropriate authoring destination via `npx @taskless/cli help route`.

The description SHALL NOT instruct the agent to suppress or quiet itself merely because a lint/format/static-analysis tool is named, and SHALL NOT contain a blanket "do NOT trigger on generic linting" instruction.

#### Scenario: Description includes anchored trigger phrases

- **WHEN** the skill `description` field is read
- **THEN** it SHALL include trigger phrases such as "create/add/write a taskless rule", "improve/fix/iterate on this taskless rule", "run taskless", "taskless login", "add taskless to CI"
- **AND** SHALL include a rule-authoring clause covering "add/write/create a rule" for code

#### Scenario: Naming a linter engages routing rather than suppressing

- **WHEN** the user asks to add/write/create a rule and names a specific lint/format/static-analysis tool (for example "write an eslint rule for X")
- **THEN** the skill SHALL trigger and route the request via `npx @taskless/cli help route`
- **AND** SHALL NOT quiet itself to a one-line offer on the basis of the named tool

#### Scenario: Description omits suppression and the prior blanket carve-out

- **WHEN** the skill `description` field is read
- **THEN** it SHALL NOT contain wording instructing the agent to suppress on a named lint/format/static-analysis tool
- **AND** it SHALL NOT contain wording instructing the agent to never trigger on generic ESLint/linting requests

#### Scenario: Description is at most 1024 characters

- **WHEN** the skill `description` field length is measured
- **THEN** it SHALL be at most 1024 characters (Agent Skills spec limit)

## ADDED Requirements

### Requirement: Skill routes authoring requests through the routing front door

The skill body SHALL route rule-authoring requests through `npx @taskless/cli help route`
as the authoring front door, rather than fetching `rule create` directly. The
skill SHALL add no linter knowledge of its own and SHALL remain a thin router that
defers all authoring judgment to the fetched recipes.

#### Scenario: Authoring requests are routed via route

- **WHEN** the user asks to author a rule (with or without naming a tool)
- **THEN** the skill body SHALL direct the agent to fetch `npx @taskless/cli help route`
  before any login-gated path
- **AND** SHALL NOT embed linter-specific rule knowledge in the skill body

#### Scenario: Local-first before login

- **WHEN** the routing recipe has not yet demonstrated that a rule cannot be built
  locally
- **THEN** the skill SHALL NOT direct the agent toward a login-gated authoring
  path
