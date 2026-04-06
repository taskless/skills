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

Every `capture()` call SHALL include the `cli` property (anonymous UUID). When authenticated, the `groups` parameter SHALL include `{ organization: String(orgId) }`.

#### Scenario: Anonymous capture includes standard properties

- **WHEN** `capture("cli_check")` is called without authentication
- **THEN** the event SHALL include `{ cli: anonymousUuid }`
- **AND** the event SHALL NOT include a `groups` parameter

#### Scenario: Authenticated capture includes standard properties and group

- **WHEN** `capture("cli_rule_create")` is called with authentication
- **THEN** the event SHALL include `{ cli: anonymousUuid }`
- **AND** the `groups` parameter SHALL include `{ organization: String(orgId) }`

### Requirement: CLI events use cli\_ prefix

All CLI events SHALL use the `cli_` prefix and `snake_case` naming. The following events SHALL be emitted:

| Event                      | Command                   |
| -------------------------- | ------------------------- |
| `cli_help`                 | `help` (top-level)        |
| `cli_help_auth`            | `help auth [subcommand]`  |
| `cli_help_check`           | `help check`              |
| `cli_help_info`            | `help info`               |
| `cli_help_init`            | `help init`               |
| `cli_help_rule`            | `help rules [subcommand]` |
| `cli_auth_login`           | `auth login` (initiated)  |
| `cli_auth_login_completed` | `auth login` (succeeded)  |
| `cli_auth_logout`          | `auth logout`             |
| `cli_check`                | `check`                   |
| `cli_init`                 | `init`                    |
| `cli_info`                 | `info`                    |
| `cli_rule_create`          | `rules create`            |
| `cli_rule_improve`         | `rules improve`           |
| `cli_rule_delete`          | `rules delete`            |
| `cli_rule_verify`          | `rules verify`            |
| `cli_rule_meta`            | `rules meta`              |

#### Scenario: Each command emits its event

- **WHEN** a user runs `taskless check`
- **THEN** the CLI SHALL emit a `cli_check` event before the command logic executes

#### Scenario: Help for specific topic emits scoped event

- **WHEN** a user runs `taskless help rules`
- **THEN** the CLI SHALL emit a `cli_help_rule` event

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
