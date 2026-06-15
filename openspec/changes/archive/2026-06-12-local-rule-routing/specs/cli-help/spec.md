## ADDED Requirements

### Requirement: Routing topics are registered in the help system

The help system SHALL register the routing recipes `route`, `existing`, `static`,
and `remote` as embedded help topics, retrievable via `taskless help <topic>` and
listed in the help index, consistent with the existing topic embedding and format
requirements.

#### Scenario: Routing topics resolve

- **WHEN** `taskless help route`, `taskless help existing`,
  `taskless help static`, or `taskless help remote` is run
- **THEN** the corresponding recipe text SHALL be returned
- **AND** an unknown-topic error SHALL NOT be raised for any of the four

#### Scenario: Routing topics appear in the index

- **WHEN** `taskless help` (no arguments) is run
- **THEN** the topic index SHALL include the routing topics so an agent can
  discover the authoring front door

### Requirement: Routing topics emit intent telemetry

Fetching a routing recipe SHALL emit a per-topic intent telemetry event,
consistent with the existing `help_<topic>` telemetry convention.

#### Scenario: Help topic intent is captured for routing recipes

- **WHEN** the agent fetches `route`, `existing`, `static`, or `remote`
- **THEN** the help command SHALL capture the corresponding `help_<topic>` intent
  event with the topic name
