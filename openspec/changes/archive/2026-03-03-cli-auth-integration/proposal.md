## Why

The CLI auth system (`auth login`/`auth logout`) was built with a stubbed network layer — the full command UX and token storage work, but no actual HTTP calls are made. The real API endpoints are now available at `POST /cli/auth/device`, `POST /cli/auth/token`, and `GET /cli/auth/verify`. This change replaces the stub with a real HTTP implementation so users can actually authenticate. This is a prerequisite for `cli-rules`, which requires a valid token to call the rule generation API.

## What Changes

- Replace `StubDeviceFlowProvider` with a real HTTP implementation that calls `POST /cli/auth/device` and `POST /cli/auth/token`
- Update the `DeviceFlowProvider` interface to match the real API request/response shapes (endpoint paths, field names)
- Configure the API base URL (`https://app.taskless.io/cli/`) with optional env var override for development
- Update the existing `cli-auth` spec to replace the "stub" requirement with real HTTP implementation requirements

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `cli-auth`: The network layer requirement changes from "stub that returns an error" to "real HTTP implementation calling `/cli/auth/device` and `/cli/auth/token`". The `DeviceFlowProvider` interface shape is updated to match the real API.

## Impact

- **packages/cli/src/actions/device-flow.ts**: `StubDeviceFlowProvider` replaced with `HttpDeviceFlowProvider`. Interface types updated to match real API shapes.
- **packages/cli/**: API base URL configuration added (likely a constant or env var).
- **No breaking changes**: Token storage, `getToken()`, `auth login`/`auth logout` command UX all remain the same. The only change is what happens when the network call is made.
