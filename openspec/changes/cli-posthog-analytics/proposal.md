## Why

The CLI has zero telemetry. We have no visibility into which commands are used, how often, or whether users are authenticated. The backend already uses PostHog across dashboard, generator, and webhook workers — the CLI is the last surface without analytics. Adding PostHog to the CLI lets us correlate CLI usage with backend events (same project token, same identity model) and understand the full user journey.

## What Changes

- Add a `posthog-node` telemetry module that creates a PostHog client per command invocation with proper lifecycle management (`flushAt: 1`, `flushInterval: 0`, `shutdown()`)
- Persist an anonymous UUID v4 in the XDG config directory (`~/.config/taskless/anonymous_id`) as the default `distinctId`
- When a JWT is available, prefer the JWT subject as `distinctId` and associate the user's org via `groupIdentify`
- Respect `TASKLESS_TELEMETRY_DISABLED=1` and `DO_NOT_TRACK=1` by returning an inert no-op client
- Emit `cli_`-prefixed events from each command handler
- Update `.conventions/posthog.md` to document CLI-specific analytics conventions (already done)

## Capabilities

### New Capabilities

- `analytics`: PostHog telemetry module — anonymous identity, authenticated identity upgrade, opt-out, event capture, and client lifecycle for the CLI

### Modified Capabilities

_None. Events are added to existing command handlers but do not change their behavior._

## Impact

- `packages/cli/src/telemetry.ts` — New module: PostHog client creation, identity resolution, no-op stub
- `packages/cli/src/index.ts` — Initialize telemetry, pass to subcommands, shutdown on exit
- `packages/cli/src/commands/*.ts` — Add `capture()` calls in each command handler
- `packages/cli/package.json` — Add `posthog-node` dependency
- `.conventions/posthog.md` — Already updated with CLI conventions
