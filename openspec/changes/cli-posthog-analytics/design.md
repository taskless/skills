## Context

The CLI is a short-lived Node.js process built with citty. Each invocation runs a single subcommand and exits. There is no persistent process, no daemon, no background worker. The backend already uses `posthog-node` across Cloudflare Workers with per-request lifecycle — the CLI follows the same pattern but with per-invocation lifecycle.

The CLI already has XDG config support (`getConfigDirectory()` in `src/auth/token.ts`) and JWT decoding (`decodeOrgId()` in `src/auth/jwt.ts`). The anonymous ID file and identity upgrade logic build on these existing primitives.

## Goals / Non-Goals

**Goals:**

- Capture one event per CLI command invocation with minimal overhead
- Link anonymous and authenticated usage via a stable device UUID
- Respect `DO_NOT_TRACK` and `TASKLESS_TELEMETRY_DISABLED` environment variables
- Zero impact on CLI behavior — telemetry failures must never cause command failures

**Non-Goals:**

- Session tracking or multi-event flows within a single invocation
- Performance profiling or timing data (can be added later per-event)
- Collecting command arguments or user input as properties
- Retry logic for failed event delivery

## Decisions

**Single `telemetry.ts` module vs. scattered PostHog calls**

All PostHog logic lives in one module (`src/telemetry.ts`) that exports `createTelemetry()`. This returns an object with `capture()`, `identify()`, and `shutdown()` methods. When telemetry is disabled, the same interface is returned with no-op implementations. Command handlers call `capture()` without knowing whether telemetry is active.

_Alternative: Import `posthog-node` directly in each command file. Rejected — duplicates opt-out checks, identity resolution, and lifecycle management across every handler._

**Anonymous ID storage: dedicated file vs. config.json field**

Store the anonymous UUID in its own file (`anonymous_id`) in the XDG config directory rather than adding a field to `config.json`. This keeps the telemetry concern isolated and avoids coupling with API configuration.

_Alternative: Add an `anonymousId` field to `config.json`. Rejected — config.json is for API URL overrides; mixing concerns makes it harder to reason about._

**Identity resolution at telemetry init vs. per-capture**

Resolve identity once at `createTelemetry()` time. The JWT and anonymous ID don't change during a single CLI invocation, so there's no reason to re-resolve on every `capture()` call.

_Alternative: Lazy resolution on first capture. Rejected — adds complexity for no benefit in a short-lived process._

**No-op stub vs. null client**

When telemetry is disabled, return a conforming object with no-op methods rather than `null`. This eliminates conditional checks (`if (telemetry)`) at every call site.

_Alternative: Return `null` and use optional chaining. Rejected — more error-prone and noisier in command code._

**Hardcoded constants vs. environment variables for PostHog config**

The project token and host URL are hardcoded in `telemetry.ts`. These are the shared Taskless project credentials, not secrets. Hardcoding avoids the need for wrangler vars (which don't apply to the CLI) or `.env` files.

_Alternative: Use environment variables. Rejected — these are public values that don't vary between environments. The CLI doesn't have a staging deployment._

**Lifecycle: init in main, shutdown in main**

`createTelemetry()` is called in the main entry point before subcommand dispatch. The returned object is passed to subcommands (or accessed via a module-level singleton). `shutdown()` is called after the subcommand completes, in a `finally` block or process exit handler.

_Alternative: Create/shutdown in each subcommand. Rejected — duplicates lifecycle code and risks forgetting shutdown in new commands._

## Risks / Trade-offs

**[Telemetry adds a dependency]** → `posthog-node` adds to the bundle size. Acceptable — it's a small library and the CLI already bundles several dependencies via Vite.

**[Anonymous ID file could be deleted]** → If the user deletes `~/.config/taskless/anonymous_id`, a new UUID is generated. This breaks continuity for that device. Acceptable — this is a privacy feature, not a bug.

**[No retry on failed delivery]** → If the PostHog API is unreachable, the event is silently lost. Acceptable — telemetry is best-effort and must never block the user.

**[flushAt: 1 means one HTTP request per event]** → Since the CLI only captures one event per invocation, this is exactly one request. No batching overhead.
