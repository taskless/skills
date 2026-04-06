# PostHog Analytics (CLI)

## Overview

The CLI uses `posthog-node` to capture usage events. The PostHog client is created once per command invocation and shut down before the process exits.

### Configuration

The CLI uses hardcoded constants (not environment variables):

```ts
const POSTHOG_PROJECT_TOKEN =
  "phc_stymptTiUskp4zM3m9StNSGheHwjskaYagpxV7rDjZyc";
const POSTHOG_HOST = "https://z.taskless.io";
```

These are the shared Taskless project credentials and allow correlating CLI usage with other Taskless surfaces. They are safe to commit.

### Disabling Telemetry

Setting either environment variable disables telemetry entirely:

- `TASKLESS_TELEMETRY_DISABLED=1`
- `DO_NOT_TRACK=1`

When disabled, the module exports an inert stub (same interface, all methods are no-ops) so callers do not need conditional checks.

## Identity Model

The CLI uses a layered identity strategy to connect anonymous and authenticated usage.

### Anonymous Identity (Default)

A UUID v4 is generated on first run and persisted to the XDG config directory (`$XDG_CONFIG_HOME/taskless/anonymous_id` or `~/.config/taskless/anonymous_id`). This ID is stable across invocations and repositories.

All `identify` and `capture` calls include a `cli` property set to this XDG UUID so that even after an authenticated user is resolved, the anonymous device can be linked.

### Authenticated Identity (Preferred)

When a local repo auth JWT is available (`.taskless/.env.local.json` or `TASKLESS_TOKEN` env var), the CLI should:

1. Use the JWT **subject** (`sub` claim) as the `distinctId`.
2. Call `groupIdentify` with the JWT **org ID** (`orgId` claim) as the `organization` group key.
3. Call `identify` with the `cli` property set to the XDG anonymous UUID, linking the device to the authenticated user.

This ensures that if a user moves between authenticated and unauthenticated repositories, their activity can still be connected.

### Identity Flowchart

```
Has valid JWT?
  ├─ Yes → distinctId = jwt.sub
  │        groupIdentify organization = jwt.orgId
  │        identify { cli: xdg_uuid }
  └─ No  → distinctId = xdg_uuid
```

### Privacy

Do not send PII (email, display name, real names) in `identify()` calls or event properties. Use only internal IDs (`jwt.sub`, `jwt.orgId`, XDG UUID) for identification.

## Client Lifecycle

```ts
import { PostHog } from "posthog-node";

const posthog = new PostHog(POSTHOG_PROJECT_TOKEN, {
  host: POSTHOG_HOST,
  flushAt: 1,
  flushInterval: 0,
});

try {
  // resolve identity, capture events
} finally {
  await posthog.shutdown();
}
```

Use `flushAt: 1` and `flushInterval: 0` because the CLI process is short-lived. Call `shutdown()` before exiting so buffered events are flushed.

## Event Naming

All CLI events use the `cli_` prefix and `snake_case`. The name reflects the intended action.

## CLI Events

| Event                      | Description                                                    |
| -------------------------- | -------------------------------------------------------------- |
| `cli_help`                 | User invoked top-level help (no arguments)                     |
| `cli_help_auth`            | User invoked help for auth commands (`topic` has full subpath) |
| `cli_help_check`           | User invoked help for the check command                        |
| `cli_help_info`            | User invoked help for the info command                         |
| `cli_help_init`            | User invoked help for the init command                         |
| `cli_help_rule`            | User invoked help for rule commands (`topic` has full subpath) |
| `cli_auth_login`           | User initiated device-flow login                               |
| `cli_auth_login_completed` | Device-flow login completed successfully                       |
| `cli_auth_logout`          | User logged out (removed stored credentials)                   |
| `cli_check`                | User ran a rules check against the codebase                    |
| `cli_init`                 | User ran init to install/update skills                         |
| `cli_info`                 | User ran info to display CLI status                            |
| `cli_rule_create`          | User submitted a rule creation request                         |
| `cli_rule_improve`         | User submitted a rule improvement/iteration                    |
| `cli_rule_delete`          | User deleted a rule and its associated files                   |
| `cli_rule_verify`          | User ran local rule verification                               |
| `cli_rule_meta`            | User retrieved or updated rule metadata                        |

### Standard Properties

All CLI events should include:

| Property | Type   | Description                         |
| -------- | ------ | ----------------------------------- |
| `cli`    | string | XDG anonymous UUID (always present) |

### Group Analytics

When an authenticated JWT is available, include the `organization` group on all `capture` calls:

```ts
posthog.capture({
  distinctId,
  event: "cli_rule_create",
  properties: { cli: xdgUuid, anonymous: false },
  groups: { organization: orgId },
});
```

## Testing

Mock `posthog-node` in tests:

```ts
vi.mock("posthog-node", () => {
  return {
    PostHog: class {
      capture = vi.fn();
      identify = vi.fn();
      groupIdentify = vi.fn();
      shutdown = vi.fn().mockResolvedValue(undefined);
    },
  };
});
```

Mocking `posthog-node` via `vi.mock` is sufficient to prevent real events from being sent, even in tests that exercise the enabled telemetry path. For integration or end-to-end test suites that do not mock PostHog, set `TASKLESS_TELEMETRY_DISABLED=1` as an extra safeguard.
