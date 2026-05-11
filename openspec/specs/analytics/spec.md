# Analytics

## Purpose

Defines the PostHog telemetry module for the `@taskless/cli` package — anonymous identity, authenticated identity upgrade, opt-out, event capture, and client lifecycle.

## Requirements

### Requirement: Telemetry module exports getTelemetry

The CLI SHALL provide a `getTelemetry(cwd?: string)` function in `src/telemetry.ts` that returns a telemetry object with `capture(event: string, properties?: Record<string, unknown>)` and `shutdown()` methods. The function SHALL resolve identity, create the PostHog client, and call `identify()` internally before returning. The `identify()` call is not exposed on the public interface.

#### Scenario: Telemetry object is created

- **WHEN** `getTelemetry()` is called
- **THEN** it SHALL return an object with `capture` and `shutdown` methods

#### Scenario: Telemetry resolves identity on creation

- **WHEN** `getTelemetry(cwd)` is called with a working directory that has a valid JWT
- **THEN** it SHALL resolve the authenticated identity (JWT subject as `distinctId`, org group) before returning

### Requirement: Anonymous identity persists in XDG config

The CLI SHALL generate a UUID v4 on first run and persist it to `$XDG_CONFIG_HOME/taskless/anonymous_id` (or `~/.config/taskless/anonymous_id`). Subsequent invocations SHALL read the existing UUID. The file SHALL contain only the raw UUID string (no JSON, no newline).

#### Scenario: First run generates anonymous ID

- **WHEN** `getTelemetry()` is called and `anonymous_id` does not exist
- **THEN** the CLI SHALL generate a UUID v4, write it to the XDG config directory, and use it as the `distinctId`

#### Scenario: Subsequent run reads existing anonymous ID

- **WHEN** `getTelemetry()` is called and `anonymous_id` already exists
- **THEN** the CLI SHALL read the existing UUID and use it

#### Scenario: Anonymous ID file is deleted

- **WHEN** the `anonymous_id` file is manually deleted between invocations
- **THEN** the CLI SHALL generate a new UUID on the next run

#### Scenario: XDG config directory does not exist

- **WHEN** the XDG config directory (`~/.config/taskless/`) does not exist
- **THEN** the CLI SHALL create it before writing the `anonymous_id` file

### Requirement: Authenticated identity upgrade

When a valid JWT is available (via `getToken()`), the CLI SHALL use the JWT subject (`sub` claim) as the `distinctId` instead of the anonymous UUID. It SHALL call `posthog.identify()` with the `cli` property set to the anonymous UUID, linking the device to the authenticated user. It SHALL call `posthog.groupIdentify()` with the `organization` group type and the JWT `orgId` claim as the group key.

#### Scenario: JWT available upgrades identity

- **WHEN** `getTelemetry(cwd)` is called and a valid JWT exists for the working directory
- **THEN** `distinctId` SHALL be the JWT `sub` claim
- **AND** `identify()` SHALL be called with `{ cli: anonymousUuid }`
- **AND** `groupIdentify()` SHALL be called with `{ groupType: 'organization', groupKey: String(orgId) }`

#### Scenario: No JWT falls back to anonymous

- **WHEN** `getTelemetry(cwd)` is called and no JWT is available
- **THEN** `distinctId` SHALL be the anonymous UUID
- **AND** `identify()` SHALL be called with `{ cli: anonymousUuid }`
- **AND** `groupIdentify()` SHALL NOT be called

### Requirement: Telemetry is disabled by environment variable

Setting `TASKLESS_TELEMETRY_DISABLED=1` or `DO_NOT_TRACK=1` SHALL cause `getTelemetry()` to return an inert stub with no-op implementations of `capture` and `shutdown`. No PostHog client SHALL be created. No network requests SHALL be made. No anonymous ID file SHALL be read or written.

#### Scenario: TASKLESS_TELEMETRY_DISABLED disables telemetry

- **WHEN** `TASKLESS_TELEMETRY_DISABLED` is set to `"1"`
- **THEN** `getTelemetry()` SHALL return a no-op stub
- **AND** no PostHog client SHALL be instantiated

#### Scenario: DO_NOT_TRACK disables telemetry

- **WHEN** `DO_NOT_TRACK` is set to `"1"`
- **THEN** `getTelemetry()` SHALL return a no-op stub

#### Scenario: Telemetry enabled by default

- **WHEN** neither `TASKLESS_TELEMETRY_DISABLED` nor `DO_NOT_TRACK` is set
- **THEN** `getTelemetry()` SHALL create a real PostHog client

### Requirement: PostHog client uses hardcoded constants

The PostHog client SHALL be created with project token `phc_stymptTiUskp4zM3m9StNSGheHwjskaYagpxV7rDjZyc` and host `https://z.taskless.io`. These SHALL be hardcoded constants in the telemetry module, not read from environment variables or config files.

#### Scenario: Client uses correct project token and host

- **WHEN** a PostHog client is created
- **THEN** it SHALL use the hardcoded project token and host URL

### Requirement: PostHog client uses immediate flush

The PostHog client SHALL be created with `flushAt: 1` and `flushInterval: 0` because the CLI is a short-lived process. `shutdown()` SHALL be called before the process exits to ensure buffered events are delivered.

#### Scenario: Events flush immediately

- **WHEN** `capture()` is called
- **THEN** the event SHALL be flushed immediately (not batched)

#### Scenario: Shutdown flushes remaining events

- **WHEN** `shutdown()` is called
- **THEN** all buffered events SHALL be flushed before the promise resolves

### Requirement: All capture calls include standard properties

Every `capture()` call SHALL include the `cli` property (anonymous UUID), the `cliVersion` property (the `@taskless/cli` package version read from `package.json`), and the `scaffoldVersion` property (the `version` field from `.taskless/taskless.json`, or `0` if the manifest is absent or unreadable). When authenticated, the `groups` parameter SHALL include `{ organization: String(orgId) }`. The `cliVersion` and `scaffoldVersion` values SHALL be resolved once at telemetry initialization and attached to every subsequent `capture()` call without re-reading the source files.

#### Scenario: Anonymous capture includes standard properties

- **WHEN** `capture("cli_check")` is called without authentication
- **THEN** the event SHALL include `{ cli: anonymousUuid, cliVersion: <string>, scaffoldVersion: <number> }`
- **AND** the event SHALL NOT include a `groups` parameter

#### Scenario: Authenticated capture includes standard properties and group

- **WHEN** `capture("cli_rule_create")` is called with authentication
- **THEN** the event SHALL include `{ cli: anonymousUuid, cliVersion: <string>, scaffoldVersion: <number> }`
- **AND** the `groups` parameter SHALL include `{ organization: String(orgId) }`

#### Scenario: Scaffold version falls back to 0 when manifest missing

- **WHEN** `getTelemetry(cwd)` is initialized in a directory with no `.taskless/taskless.json`
- **THEN** every `capture()` call from the returned client SHALL include `scaffoldVersion: 0`

#### Scenario: CLI version is resolved from package.json

- **WHEN** `getTelemetry()` is initialized
- **THEN** `cliVersion` SHALL be read from `packages/cli/package.json` (bundled at build time or read at runtime)
- **AND** SHALL be attached to every event emitted through the returned client

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

### Requirement: Wrong-topic re-routing is observable as a derivable funnel

The new event taxonomy is structured so that wrong-topic re-routing is a derivable funnel signal:

- A `help_<topic_a>` event followed by no `cli_<action_a>` event AND a subsequent `help_<topic_b>` event indicates the agent fetched the recipe for topic A, did not act on it, and re-routed to topic B
- A `help_index` event followed by a `help_<topic>` event indicates the agent consulted the index before picking a topic (expected behavior; baseline)
- A `help_<topic>` event with no subsequent `cli_<action>` event AND no further `help_*` event indicates the agent abandoned the action

No additional events SHALL be added to capture this signal directly — the funnel is derivable from the event sequence in PostHog. Dashboards SHOULD be created to surface re-routing rates per topic so wrong-topic confusion can be measured.

#### Scenario: Funnel data supports wrong-topic detection

- **WHEN** dashboards are constructed in PostHog
- **THEN** the events SHALL be sufficient to compute "rate of `help_<topic>` events not followed by a corresponding `cli_<action>` event within N minutes"

### Requirement: Telemetry failures are silent

All telemetry operations (client creation, `capture`, `identify`, `groupIdentify`, `shutdown`) SHALL catch and suppress errors. A telemetry failure SHALL NOT cause a command to fail or alter its exit code.

#### Scenario: Network failure during capture

- **WHEN** the PostHog API is unreachable during `capture()`
- **THEN** the error SHALL be silently suppressed
- **AND** the command SHALL continue normally

#### Scenario: Malformed anonymous ID file

- **WHEN** the `anonymous_id` file exists but contains invalid content
- **THEN** the CLI SHALL generate a new UUID and overwrite the file

### Requirement: Telemetry lifecycle uses lazy init with centralized shutdown

Each command handler SHALL call `getTelemetry(cwd)` to lazily initialize the singleton with the correct working directory for identity resolution. The main entry point (`src/index.ts`) SHALL call `shutdownTelemetry()` in a `finally` block after the subcommand completes. If no command initialized telemetry, shutdown SHALL be a no-op (no PostHog client created).

#### Scenario: Telemetry is initialized lazily by command handler

- **WHEN** a subcommand handler runs
- **THEN** it SHALL call `getTelemetry(cwd)` to initialize telemetry with the resolved working directory

#### Scenario: Telemetry is shut down after subcommand completes

- **WHEN** a subcommand handler returns
- **THEN** `shutdownTelemetry()` SHALL be called in the entry point `finally` block before the process exits

#### Scenario: No telemetry init when no command runs

- **WHEN** the CLI exits without running a command (e.g. showing top-level help)
- **THEN** `shutdownTelemetry()` SHALL be a no-op and no PostHog client SHALL be created
