## 1. Add posthog-node dependency

- [x] 1.1 Add `posthog-node` to `packages/cli/package.json` dependencies
- [x] 1.2 Run `pnpm install` to update the lockfile
- [x] 1.3 Verify the dependency resolves correctly

## 2. Create telemetry module

- [x] 2.1 Create `packages/cli/src/telemetry.ts` with hardcoded PostHog constants (`POSTHOG_PROJECT_TOKEN`, `POSTHOG_HOST`)
- [x] 2.2 Implement `getOrCreateAnonymousId()` — reads `anonymous_id` from XDG config dir, generates UUID v4 if missing, creates directory if needed
- [x] 2.3 Implement `isTelemetryDisabled()` — checks `TASKLESS_TELEMETRY_DISABLED=1` and `DO_NOT_TRACK=1`
- [x] 2.4 Implement no-op stub that conforms to the telemetry interface (`capture`, `identify`, `shutdown` as no-ops)
- [x] 2.5 Implement `createTelemetry(cwd?: string)` — resolves anonymous ID, checks for JWT via `getToken(cwd)`, decodes `sub` and `orgId` from JWT, creates PostHog client with `flushAt: 1` / `flushInterval: 0`, calls `identify()` and optionally `groupIdentify()`, returns telemetry object
- [x] 2.6 Implement `capture(event, properties?)` — merges standard properties (`cli`) and `groups` when authenticated

## 3. Wire telemetry into CLI entry point

- [x] 3.1 Update `packages/cli/src/index.ts` to call `createTelemetry(cwd)` before subcommand dispatch
- [x] 3.2 Ensure `shutdown()` is called after the subcommand completes (wrap in try/finally or process exit handler)
- [x] 3.3 Make the telemetry object accessible to subcommand handlers (module-level export or pass via context)

## 4. Add capture calls to command handlers

- [x] 4.1 `src/commands/help.ts` — emit `cli_help` for top-level help, `cli_help_rule` for rules-specific help
- [x] 4.2 `src/commands/auth.ts` — emit `cli_auth_login` when device flow starts, `cli_auth_login_completed` on success, `cli_auth_logout` in the logout handler
- [x] 4.3 `src/commands/check.ts` — emit `cli_check`
- [x] 4.4 `src/commands/init.ts` — emit `cli_init`
- [x] 4.5 `src/commands/info.ts` — emit `cli_info`
- [x] 4.6 `src/commands/rules.ts` — emit `cli_rule_create`, `cli_rule_improve`, `cli_rule_verify`, `cli_rule_meta` in respective handlers

## 5. Write tests

- [x] 5.1 Test `getOrCreateAnonymousId()` — generates UUID on first call, reads existing on second, creates directory if missing
- [x] 5.2 Test `isTelemetryDisabled()` — returns true for each env var, false when unset
- [x] 5.3 Test `createTelemetry()` with telemetry disabled — returns no-op stub, no PostHog instantiation
- [x] 5.4 Test `createTelemetry()` without JWT — uses anonymous UUID as distinctId, no groupIdentify
- [x] 5.5 Test `createTelemetry()` with JWT — uses JWT sub as distinctId, calls groupIdentify with orgId
- [x] 5.6 Test `capture()` — includes standard properties (`cli`), includes `groups` when authenticated
- [x] 5.7 Ensure test environment sets `TASKLESS_TELEMETRY_DISABLED=1` to prevent real PostHog calls (mocked via vi.mock)

## 6. Verify

- [x] 6.1 Run `pnpm typecheck` — no type errors
- [x] 6.2 Run `pnpm lint` — no lint errors
- [x] 6.3 Run `pnpm test` — all 110 tests pass (12 files, including 14 new telemetry tests)
- [x] 6.4 Run `pnpm build` — CLI builds successfully with the new module bundled
