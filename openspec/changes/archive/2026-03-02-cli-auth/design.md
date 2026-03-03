## Context

The CLI is currently offline-only. All commands operate on local files without network access or user identity. The proposal introduces authentication via the OAuth Device Flow (RFC 8628) so the CLI can identify users for future API interactions with taskless.io.

The CLI uses `citty` for command parsing and `vite` for bundling. Subcommands follow a pattern of a command definition in `commands/` and supporting logic in `actions/`. The `info` command already outputs JSON with version and tool information.

## Goals / Non-Goals

**Goals:**

- Add `auth login` and `auth logout` CLI subcommands
- Implement the Device Flow polling loop (stubbed behind an interface until the API exists)
- Persist tokens in the user's XDG config directory with env var override
- Expose login status in the `info` command output
- Document the API contract taskless.io must implement

**Non-Goals:**

- Implementing the server-side auth endpoints (documented in `cli-auth-api` spec only)
- Token refresh or rotation (the CLI stores what it receives; refresh logic comes later if needed)
- System keychain integration (only `gh` does this; plain-text XDG + env var is the industry norm)
- The `/taskless:auth` skill (can be a follow-up change)
- Scoped permissions or role-based access (taskless.io handles authorization; the CLI just needs identity)

## Decisions

### 1. OAuth Device Flow (RFC 8628) over Localhost Redirect

The Device Flow has the CLI display a URL and user code, then poll until the user authorizes in a browser. The alternative is starting a localhost HTTP server and using an OAuth redirect.

**Chose Device Flow because:**

- Works in SSH, WSL, containers, and CI — no localhost server needed
- No port conflicts or firewall issues
- Simpler to implement (HTTP polling vs. running a temp server + PKCE)
- The user can authorize on a different device entirely
- `gh` and Vercel both use this pattern and have validated it at scale

**Trade-off:** Slightly more friction for the user (must enter a code) compared to the seamless browser redirect. Acceptable given the environments developers work in.

### 2. XDG Config Directory for Token Storage

Tokens are stored at `$XDG_CONFIG_HOME/taskless/auth.json`, defaulting to `~/.config/taskless/auth.json`.

**Alternatives considered:**

- **Project-local `.taskless/auth.json`**: Rejected. The token represents "who you are," not "which project." Per-project tokens mean logging in once per repo. Also risky — `.gitignore` is a hope, not a guarantee.
- **`~/.taskless/auth.json`**: Simpler but doesn't respect XDG. Adds another dotdir to `$HOME`.
- **System keychain**: Best security (encrypted at rest) but requires three platform-specific implementations and breaks in headless/CI. Only `gh` does this and still needs a file fallback.

**Chose XDG because:**

- Standard on Linux, reasonable on macOS (`~/.config/` works fine)
- Respects `$XDG_CONFIG_HOME` for users who customize it
- What Vercel does; well-understood pattern
- Single login works across all projects
- Away from the repo — can't accidentally `git add`

### 3. `TASKLESS_TOKEN` Environment Variable Override

If `TASKLESS_TOKEN` is set, it takes precedence over the file-based token. No file read occurs.

**Rationale:** Every CLI tool in the space does this (`GH_TOKEN`, `CLOUDFLARE_API_TOKEN`, `VERCEL_TOKEN`, `FLY_ACCESS_TOKEN`). It's the standard pattern for CI/CD and headless environments. Users expect it.

### 4. Network Layer Behind an Interface

The actual HTTP calls to taskless.io (device authorization, token polling) are defined as a TypeScript interface. The initial implementation uses a stub that returns an error directing users to wait for API availability. When the API ships, swap in the real HTTP client.

**Rationale:** Lets us build and ship the full CLI UX, token storage, and command structure now. The API team can build against the `cli-auth-api` spec independently. No throwaway code.

### 5. Auth as a Subcommand Group

`taskless auth login` and `taskless auth logout` rather than top-level `taskless login`.

**Rationale:** Follows the `gh auth` and `wrangler auth` pattern. Groups auth commands cleanly. Leaves room for future subcommands (`auth status`, `auth token`) without polluting the top-level namespace.

### 6. `loggedIn` as a Simple File Check

The `info` command reports `loggedIn: true/false` based on whether a token exists (file or env var). It does NOT validate the token against the server.

**Rationale:** `info` should be fast and offline-capable. Token validation requires a network call and introduces failure modes. If the token is expired or revoked, the user will find out when they try to use it — not from `info`.

## Risks / Trade-offs

- **Token stored as plain text on disk** → Mitigated by XDG directory (not in repo), standard file permissions (`0600`), and env var for CI. This is what npm, Wrangler, Vercel, and flyctl all do.
- **No token validation in `info`** → A stale token reports `loggedIn: true`. Acceptable — users discover invalidity at usage time, same as `gh`.
- **Device Flow requires a browser somewhere** → If the user has no browser on any device, they can't auth. Mitigated by `TASKLESS_TOKEN` env var (generate a token through the web UI and paste it).
- **Stub network layer ships before real API** → Users who run `auth login` before the API exists get a clear error message. No silent failure.
- **XDG path on macOS** → `~/.config/` is not the macOS convention (`~/Library/Application Support/`), but many developer tools use it and it works fine. Keeps the implementation simple (one path convention).

## API Contract (for taskless.io)

The server must implement these endpoints to support the Device Flow:

```
POST /device/authorize
  Request:  { client_id: string, scope?: string }
  Response: { device_code: string, user_code: string,
              verification_uri: string, verification_uri_complete?: string,
              expires_in: number, interval: number }

POST /oauth/token
  Request:  { grant_type: "urn:ietf:params:oauth:grant-type:device_code",
              device_code: string, client_id: string }
  Response (pending):  { error: "authorization_pending" }
  Response (slow):     { error: "slow_down" }
  Response (expired):  { error: "expired_token" }
  Response (denied):   { error: "access_denied" }
  Response (success):  { access_token: string, token_type: "bearer",
                         expires_in?: number, refresh_token?: string }

GET /whoami
  Headers:  Authorization: Bearer <access_token>
  Response: { user: string, email?: string }
```

These follow RFC 8628 and standard OAuth 2.0 conventions. The exact paths may change; the contract is the shape of the request/response pairs.
