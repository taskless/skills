## ADDED Requirements

### Requirement: Every invocation emits exactly one cli_run event

The CLI SHALL emit exactly one `cli_run` event per invocation, from the top-level
runner rather than from individual commands. The event SHALL carry the properties
`command` (the resolved subcommand name, e.g. `"rule create"` or `"help"`),
`success` (boolean), `durationMs` (number), `anonymous` (boolean), and `loggedIn`
(boolean). The CLI version is provided by the standard `cliVersion` property
attached to every event (see the standard-properties requirement); `cli_run`
SHALL NOT introduce a second version field. The event SHALL be emitted on both
success and failure (from a `finally`-equivalent path), and no command SHALL emit
its own "started" or "ran" event.

#### Scenario: A successful command emits one cli_run

- **WHEN** a user runs `taskless info`
- **THEN** PostHog SHALL receive exactly one `cli_run` event with
  `command: "info"`, `success: true`, a numeric `durationMs`, and the
  `anonymous` and `loggedIn` properties (plus the standard `cliVersion`)
- **AND** SHALL NOT receive a separate `cli_info` or `cli_info_completed` event

#### Scenario: A failing command still emits cli_run

- **WHEN** a command exits with an error
- **THEN** PostHog SHALL receive one `cli_run` event with `success: false`

## MODIFIED Requirements

### Requirement: CLI events use cli\_ prefix

CLI events SHALL use the `cli_` prefix, with the taxonomy organized as a
`cli_run` denominator plus concrete state-transition events:

- `cli_run` — exactly one per invocation (see the dedicated requirement). This
  replaces every previous `cli_<action>` start event and `cli_<action>_completed`
  event; the `success`/`durationMs`/`command` signal lives here.
- Concrete state-transition events, each fired at the point the state actually
  changes, carrying counts/ids/booleans only (never rule content, prompts, or
  matched source):
  - `cli_rule_created`, `cli_rule_improved`, `cli_rule_deleted`
  - `cli_authenticated`, `cli_logged_out`
  - `cli_installed`, `cli_onboarded`
  - `cli_check_completed` — error/warning counts only (e.g. `errorCount`,
    `warningCount`, `findings`)
  - `cli_error` — a single failure event with `command` and `code` (a stable
    `CliErrorCode`)
- `cli_help` — fired when the help command serves a request, with a `topic`
  property. The `topic` SHALL be: the served topic for a known topic (e.g.
  `"rule create"`); the exact literal `"(index)"` when invoked with no topic;
  and the attempted topic string when the topic is unknown. This single event
  replaces the previous `help_index`, `help_<topic>`, and `help_unknown` events.

Commands that carry no concrete state beyond the invocation (e.g. `info`,
`detect`, `update`, `auth status`, `rule verify`, `rule meta`) SHALL rely on
`cli_run` alone and SHALL NOT emit a bespoke event. The previous taxonomy
(`cli_<action>`, `cli_<action>_completed`, `help_index`, `help_<topic>`,
`help_unknown`) SHALL be removed in this release; there is no dual-emit window.

#### Scenario: Rule creation emits a concrete state event plus cli_run

- **WHEN** a user runs `taskless rule create --from req.json` and a rule is written
- **THEN** PostHog SHALL receive one `cli_run` event with `command: "rule create"`
- **AND** SHALL receive a `cli_rule_created` event
- **AND** SHALL NOT receive `cli_rule_create` or `cli_rule_create_completed`

#### Scenario: Help fetch emits cli_help with a topic

- **WHEN** an agent runs `taskless help rule create`
- **THEN** PostHog SHALL receive a `cli_help` event with `topic: "rule create"`
- **AND** SHALL NOT receive a `help_rule_create` event

#### Scenario: Help with no topic emits cli_help with the index marker

- **WHEN** an agent runs `taskless help`
- **THEN** PostHog SHALL receive a `cli_help` event with `topic: "(index)"`
- **AND** SHALL NOT receive a `help_index` event

#### Scenario: Help with an unknown topic emits cli_help with the attempted topic

- **WHEN** an agent runs `taskless help nope`
- **THEN** PostHog SHALL receive a `cli_help` event with `topic: "nope"`
- **AND** SHALL NOT receive a `help_unknown` event

#### Scenario: A command failure emits cli_error

- **WHEN** a command fails with a known `CliErrorCode`
- **THEN** PostHog SHALL receive a `cli_error` event with `command` and `code`

#### Scenario: Old event names are not emitted

- **WHEN** any CLI command runs in this release
- **THEN** PostHog SHALL NOT receive any event named `cli_<action>_completed`,
  `help_index`, `help_<topic>`, or `help_unknown`

### Requirement: Wrong-topic re-routing is observable as a derivable funnel

The taxonomy SHALL keep wrong-topic re-routing derivable as a funnel signal from
the new events:

- A `cli_help { topic: A }` event not followed by the concrete event for topic A
  (or by `cli_run` with the corresponding `command`), and then a subsequent
  `cli_help { topic: B }`, indicates the agent fetched recipe A, did not act on
  it, and re-routed to topic B.
- A `cli_help` index-marker event followed by a `cli_help { topic }` event
  indicates the agent consulted the index before picking a topic (baseline).
- A `cli_help { topic }` event with no subsequent acting `cli_run` and no further
  `cli_help` event indicates the agent abandoned the action.

No additional events SHALL be added to capture this signal directly — it is
derivable from the `cli_help` / `cli_run` sequence. Dashboards SHOULD surface
re-routing rates per topic.

#### Scenario: Funnel data supports wrong-topic detection

- **WHEN** dashboards are constructed in PostHog
- **THEN** the `cli_help` (with `topic`) and `cli_run` (with `command`) events
  SHALL be sufficient to compute "rate of `cli_help { topic }` not followed by a
  corresponding acting `cli_run` within N minutes"

### Requirement: All capture calls include standard properties

Every `capture()` call SHALL include the `cli` property (anonymous UUID), the `cliVersion` property (the `@taskless/cli` package version read from `package.json`), and the `scaffoldVersion` property (the `version` field from `.taskless/taskless.json`, or `0` if the manifest is absent or unreadable). When authenticated, the `groups` parameter SHALL include `{ organization: String(orgId) }`. The `cliVersion` and `scaffoldVersion` values SHALL be resolved once at telemetry initialization and attached to every subsequent `capture()` call without re-reading the source files.

#### Scenario: Anonymous capture includes standard properties

- **WHEN** `capture("cli_run")` is called without authentication
- **THEN** the event SHALL include `{ cli: anonymousUuid, cliVersion: <string>, scaffoldVersion: <number> }`
- **AND** the event SHALL NOT include a `groups` parameter

#### Scenario: Authenticated capture includes standard properties and group

- **WHEN** `capture("cli_rule_created")` is called with authentication
- **THEN** the event SHALL include `{ cli: anonymousUuid, cliVersion: <string>, scaffoldVersion: <number> }`
- **AND** the `groups` parameter SHALL include `{ organization: String(orgId) }`

#### Scenario: Scaffold version falls back to 0 when manifest missing

- **WHEN** `getTelemetry(cwd)` is initialized in a directory with no `.taskless/taskless.json`
- **THEN** every `capture()` call from the returned client SHALL include `scaffoldVersion: 0`

#### Scenario: CLI version is embedded at build time

- **WHEN** `getTelemetry()` is initialized
- **THEN** `cliVersion` SHALL be the `@taskless/cli` version embedded at build time (no runtime file read), consistent with the CLI spec's build-time version requirement
- **AND** SHALL be attached to every event emitted through the returned client
