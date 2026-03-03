## Context

The CLI auth system was built with the `DeviceFlowProvider` interface pattern — a clean boundary between command logic and network calls. The current implementation (`StubDeviceFlowProvider` in `actions/device-flow.ts`) rejects all calls with an "API not yet available" error. The command UX, polling loop, and token storage all work; only the HTTP layer is missing.

The real API is now available. Auth endpoints live under `https://app.taskless.io/cli/auth/`:

- `POST /cli/auth/device` — start device flow, get user code
- `POST /cli/auth/token` — poll for authorization
- `GET /cli/auth/verify` — browser page for user approval (not called by CLI)

The token is a JWT with `iss: "cli"`, expires in 1 week (604,800 seconds). Device codes expire in 15 minutes (900 seconds) with a 5-second poll interval.

## Goals / Non-Goals

**Goals:**

- Replace `StubDeviceFlowProvider` with `HttpDeviceFlowProvider` that calls the real endpoints
- Update the `DeviceFlowProvider` interface types to match the real API shapes
- Make the API base URL configurable for development/testing
- Keep the provider pattern so the interface remains swappable

**Non-Goals:**

- Token refresh or rotation (the token expires in 1 week; user re-authenticates)
- `auth status` subcommand (follow-up)
- Integrating `whoami` into the auth flow (that's an API endpoint, not auth)
- Changing the command UX, polling loop, or token storage

## Decisions

### 1. `HttpDeviceFlowProvider` Replaces the Stub In-Place

The new implementation lives in the same file (`actions/device-flow.ts`). The stub class is removed and replaced with `HttpDeviceFlowProvider`. The exported `deviceFlowProvider` instance switches from stub to real.

**Rationale:** The provider pattern was designed for exactly this swap. No command code changes. The interface contract is maintained.

### 2. `fetch` for HTTP Calls

Use Node.js built-in `fetch` (available since Node 18) for HTTP calls. No external HTTP library needed.

**Alternatives considered:**

- **`undici`**: More control over connections, but adds a dependency for simple POST requests
- **`node:http`**: Low-level, verbose for JSON APIs

**Chose `fetch` because:** Zero dependencies, familiar API, sufficient for two simple POST endpoints. The CLI already targets Node 18+.

### 3. API Base URL as a Constant with Env Var Override

The base URL defaults to `https://app.taskless.io/cli` and can be overridden via `TASKLESS_API_URL` environment variable.

**Rationale:** Enables local development and testing without code changes. Follows the same pattern as other tools (`GH_HOST`, `CLOUDFLARE_API_BASE_URL`). The env var is developer-facing only — not documented for end users.

### 4. Interface Types Updated to Match Real API

The existing interface types (`DeviceCodeResponse`, `TokenResponse`, `TokenPollResult`) are largely correct but need minor alignment:

| Current                     | Real API                                   | Change needed                         |
| --------------------------- | ------------------------------------------ | ------------------------------------- |
| `DeviceCodeResponse` fields | Matches RFC 8628                           | No change — already correct           |
| `TokenResponse.expires_in`  | Always present (604,800)                   | Keep as optional for safety           |
| `TokenPollResult` statuses  | `pending/slow_down/success/expired/denied` | No change — matches API error strings |

The interface shape is already a good match. The main work is implementing the HTTP calls, not restructuring types.

### 5. Request Body Uses `client_id: "taskless-cli"`

The device flow request requires a `client_id`. This is hardcoded to `"taskless-cli"` as a constant.

**Rationale:** There's only one CLI client. No reason to make this configurable. If it changes, it's a code change.

## Risks / Trade-offs

- **Network errors** → `fetch` can throw on DNS failures, timeouts, etc. The command handler already wraps the provider call in try/catch, so errors surface as user-facing messages. No additional error handling needed at the provider level.
- **API downtime** → If `app.taskless.io` is down, `auth login` fails with a network error. Acceptable — this is inherent to any network-dependent auth flow.
- **JWT expiry (1 week)** → Users need to re-authenticate weekly. No refresh flow exists. Acceptable for CLI usage patterns. If this becomes friction, token refresh can be added later.
- **No certificate pinning** → Standard TLS verification via Node.js. Sufficient for a CLI tool.

## API Reference

```
POST /cli/auth/device
  Request:  { client_id: "taskless-cli", scope?: string }
  Response: {
    device_code: string,
    user_code: string,
    verification_uri: string,
    verification_uri_complete?: string,
    expires_in: number,    // 900 (15 min)
    interval: number       // 5 (seconds)
  }

POST /cli/auth/token
  Request:  {
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    device_code: string,
    client_id: "taskless-cli"
  }
  Response (pending):  { error: "authorization_pending" }
  Response (slow):     { error: "slow_down" }
  Response (expired):  { error: "expired_token" }
  Response (denied):   { error: "access_denied" }
  Response (success):  {
    access_token: string,  // JWT, iss: "cli"
    token_type: "bearer",
    expires_in: 604800     // 1 week
  }
```
