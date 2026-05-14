## ADDED Requirements

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
