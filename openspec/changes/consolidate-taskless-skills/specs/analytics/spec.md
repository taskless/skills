# Analytics

## MODIFIED Requirements

### Requirement: CLI events use cli\_ prefix

CLI action events SHALL continue to use the `cli_` prefix, but the event taxonomy SHALL be reorganized as follows:

- `cli_<action>` — fired when an action command begins execution (e.g. `cli_rule_create`, `cli_rule_improve`, `cli_rule_delete`, `cli_check`, `cli_info`, `cli_init`, `cli_auth_login`, `cli_auth_logout`)
- `cli_<action>_completed` — fired when an action command finishes execution; event properties SHALL include `success: boolean`, `durationMs: number`, and `errorCode?: string` (when failure)
- `help_<topic>` — fired when the help command serves a specific topic (e.g. `help_rule_create`, `help_check`, `help_auth`); replaces previous `cli_help_<topic>` events
- `help_index` — fired when the help command is invoked with no arguments (probable agent confusion / routing failure)
- `help_unknown` — fired when the help command receives an unknown topic; event properties SHALL include `topic: string` (the attempted topic)

The previous event names `cli_help`, `cli_help_auth`, `cli_help_check`, `cli_help_info`, `cli_help_init`, `cli_help_rule` SHALL be removed in this release. There is no dual-emit window — the rename is a hard cut.

#### Scenario: Action command emits start and completion events

- **WHEN** a user runs `taskless rule create --from req.json`
- **THEN** PostHog SHALL receive a `cli_rule_create` event when execution begins
- **AND** SHALL receive a `cli_rule_create_completed` event when execution finishes, with properties including `success`, `durationMs`, and (on failure) `errorCode`

#### Scenario: Help fetch emits topic intent

- **WHEN** an agent runs `taskless help rule create`
- **THEN** PostHog SHALL receive a `help_rule_create` event

#### Scenario: Help no-args emits index event

- **WHEN** an agent runs `taskless help`
- **THEN** PostHog SHALL receive a `help_index` event

#### Scenario: Help unknown topic emits help_unknown

- **WHEN** an agent runs `taskless help nonexistent`
- **THEN** PostHog SHALL receive a `help_unknown` event with property `topic: "nonexistent"`

#### Scenario: Old event names are not emitted

- **WHEN** any CLI command runs in v0.7.0
- **THEN** PostHog SHALL NOT receive any event named `cli_help`, `cli_help_<topic>`, or any other event under the previous taxonomy

## ADDED Requirements

### Requirement: Wrong-topic re-routing is observable as a derivable funnel

The new event taxonomy is structured so that wrong-topic re-routing is a derivable funnel signal:

- A `help_<topic_a>` event followed by no `cli_<action_a>` event AND a subsequent `help_<topic_b>` event indicates the agent fetched the recipe for topic A, did not act on it, and re-routed to topic B
- A `help_index` event followed by a `help_<topic>` event indicates the agent consulted the index before picking a topic (expected behavior; baseline)
- A `help_<topic>` event with no subsequent `cli_<action>` event AND no further `help_*` event indicates the agent abandoned the action

No additional events SHALL be added to capture this signal directly — the funnel is derivable from the event sequence in PostHog. Dashboards SHOULD be created to surface re-routing rates per topic so wrong-topic confusion can be measured.

#### Scenario: Funnel data supports wrong-topic detection

- **WHEN** dashboards are constructed in PostHog
- **THEN** the events SHALL be sufficient to compute "rate of `help_<topic>` events not followed by a corresponding `cli_<action>` event within N minutes"
