## Context

The CLI has a `check` command that reads ast-grep rules from `.taskless/rules/*.yml` and runs them against the codebase. There is no way to create these rules through the CLI. The taskless.io platform provides a rule generation service (LLM-powered) that accepts a description of what to catch and returns fully formed ast-grep rule files with optional test cases.

The auth system (`auth login`/`auth logout`, token storage at `~/.config/taskless/auth.json`, `TASKLESS_TOKEN` env var) is already implemented and provides the identity layer needed for API access. The Device Flow provider pattern in `actions/device-flow.ts` establishes the convention for stubbing network calls behind an interface until the API ships.

The CLI follows a `commands/` + `actions/` split: command definitions handle argument parsing and UX, while actions contain the business logic. Skills (Claude Code, etc.) always delegate to the CLI for execution — they gather intent conversationally, then invoke the CLI with the right arguments.

## Goals / Non-Goals

**Goals:**

- Add `taskless rules create` subcommand that reads a JSON request from stdin, submits to the taskless.io API, polls for results, and writes rule/test files to disk
- Add `taskless rules delete <id>` subcommand that removes a rule and its test files locally
- Implement against the real API endpoints (`POST /cli/api/request`, `GET /cli/api/request/:requestId`)
- Resolve `orgId` and `repositoryUrl` from `.taskless/taskless.json` project config
- Bump the minimum spec version to require `orgId` and `repositoryUrl` in `taskless.json`
- Stub the network layer behind an interface (same pattern as Device Flow) so the full CLI UX can ship before the API

**Non-Goals:**

- Implementing the server-side rule generation endpoints (documented in `cli-rules-api` spec only)
- A skill for rule authoring (follow-up change — the skill will invoke `taskless rules create` via stdin)
- Rule syncing, sharing, or publishing between repos/teams
- Editing existing rules through the CLI (users can edit `.yml` files directly)
- Interactive prompts for `rules create` (stdin-only; the skill or user constructs the JSON)

## Decisions

### 1. Stdin for Input, Not Flags or Interactive Prompts

`taskless rules create` reads a JSON payload from stdin rather than accepting flags or prompting interactively.

**Chose stdin because:**

- The primary consumer is skills, which construct JSON programmatically and pipe it in
- The request payload (description, language, optional code examples) is simple enough for a human to write as JSON if needed
- No interactive mode to break automation
- Consistent with tools like `gh api --input -` and `jq`

**Trade-off:** Slightly less discoverable for humans running the CLI directly. Acceptable because the skill is the expected entry point for most users.

### 2. Request-Based Async Polling for Rule Generation

Rule generation is async. The CLI posts to `POST /cli/api/request`, receives a `requestId`, and polls `GET /cli/api/request/:requestId` until the status reaches `generated` or `failed`. The API returns progressive statuses: `accepted` → `building` → `generated`.

**Chose request polling because:**

- Rule generation involves LLM inference, which can take seconds to minutes
- Avoids long-lived HTTP connections that proxies/firewalls may terminate
- The CLI already implements this exact pattern for Device Flow auth polling
- The requestId can be logged/retried if the CLI process is interrupted

**Polling interval:** The API does not return a suggested interval. The CLI defaults to 15 seconds between polls, since generation can take a while.

**Trade-off:** More complex than a synchronous request/response. Justified by the latency of rule generation.

### 3. Network Layer Behind an Interface (Same Pattern as Auth)

The API calls (`POST /cli/api/request` and `GET /cli/api/request/:requestId`) are defined as a TypeScript interface with a stub implementation. Mirrors `DeviceFlowProvider` in `actions/device-flow.ts`.

**Rationale:** Lets us build and ship the full CLI UX, file writing, and command structure now. When the API ships, swap in the real HTTP client. No throwaway code.

### 4. `orgId` and `repositoryUrl` Resolved from `taskless.json`

The API requires `orgId` (number) and `repositoryUrl` (string) on every generation request. Both are read from `.taskless/taskless.json`. This means the project config must include these fields, which bumps the minimum spec version.

**Rationale:** These values are project-scoped, not user-scoped. They belong in the project config alongside the spec version. The CLI already reads `taskless.json` for the `version` field; adding `orgId` and `repositoryUrl` is a natural extension. Skills and users don't need to provide these — the CLI resolves them automatically.

### 5. Rules as a Subcommand Group

`taskless rules create` and `taskless rules delete` rather than `taskless create-rule`.

**Rationale:** Follows the `taskless auth login/logout` pattern already established. Groups rule operations cleanly. Leaves room for future subcommands (`rules list`, `rules test`) without polluting the top-level namespace.

### 6. Rule Files Written as YAML from Structured Content

The API returns `GeneratedRule.content` as a typed object matching the ast-grep rule schema. The CLI serializes this to YAML and writes it to `.taskless/rules/{kebab-id}.yml`.

**Rationale:** The API returns structured data, not raw file contents. This lets the CLI validate the structure and ensures consistent YAML formatting. The `content` shape already matches the ast-grep schema, so serialization is a direct mapping.

### 7. Test Files Written to `.taskless/rule-tests/`

Test cases from `GeneratedRule.tests` are written to `.taskless/rule-tests/{kebab-id}-{timestamp}-test.yml`. The timestamp suffix groups tests from the same invocation and avoids collisions.

**Rationale:** Matches the convention already established on the server side. Test files are separate from rules because ast-grep's test runner expects them in a distinct directory. The timestamp suffix is generated by the CLI at invocation time.

### 8. `rules delete` is Local-Only

Deleting a rule removes the `.yml` file from `rules/` and any matching test files from `rule-tests/`. No API call is made.

**Rationale:** Rules live on disk. The API generates them but doesn't track them. There's no server-side state to clean up. This keeps `delete` fast, offline-capable, and simple.

### 9. Auth Required for `rules create`, Not for `rules delete`

`rules create` requires a valid auth token (it calls the API). `rules delete` works without auth (it's local file operations only).

**Rationale:** Follows the principle that only network-dependent commands require auth. A user should always be able to manage their local files without logging in.

## Risks / Trade-offs

- **Spec version bump** → `taskless.json` must include `orgId` and `repositoryUrl`, which requires a new minimum spec version. Projects on the old version will need to re-run `taskless init` or manually add the fields. The `check` command continues to work on the old version; only `rules create` requires the new version.
- **Stub ships before real API** → Users who run `rules create` before the API exists get a clear error message. Same pattern as auth, already validated.
- **Stdin-only input** → Less discoverable for CLI-only users. Mitigated by help text with examples and the expectation that skills are the primary interface.
- **No rule deduplication** → If a user creates a rule with the same ID as an existing one, the file is overwritten. Acceptable — the user (or skill) can check for conflicts before invoking.
- **Polling adds latency (15s interval)** → The user waits while the CLI polls. Mitigated by showing progress/status messages during the poll loop. 15s interval is appropriate given LLM generation time.
- **Test file timestamp suffix** → Multiple invocations on the same day for the same rule produce multiple test files. Acceptable — test files are cheap and the timestamp makes provenance clear.
- **API error diversity** → The API can return 400 (validation), 403 (repo not accessible / access denied), 404 (org not found / request not found). The CLI needs to handle each distinctly with clear user-facing messages.

## API Reference

These are the real endpoints from the taskless.io API (see `tmp/api.md` for full reference).

### Rule Generation Endpoints (used by this change)

```
POST /cli/api/request
  Headers:  Authorization: Bearer <access_token>
  Request:  {
    orgId: number,              // from .taskless/taskless.json
    repositoryUrl: string,      // from .taskless/taskless.json
    prompt: string,             // from stdin: "description" field
    language?: string,          // from stdin: "language" field
    successCase?: string,       // from stdin: "successCase" field
    failureCase?: string        // from stdin: "failureCase" field
  }
  Response (200): { requestId: string, status: "accepted" }
  Response (400): { error: "validation_error", details: string[] }
  Response (403): { error: "repository_not_accessible" }
  Response (404): { error: "organization_not_found" }

GET /cli/api/request/:requestId
  Headers:  Authorization: Bearer <access_token>
  Response (processing): { requestId, status: "accepted" | "building" }
  Response (completed):  {
    requestId: string,
    status: "generated",
    rules: [
      {
        id: string,
        content: {
          id: string,
          language: string,
          rule: object,
          severity?: "hint" | "info" | "warning" | "error" | "off",
          message?: string,
          note?: string,
          fix?: string | object,
          constraints?: object,
          utils?: object,
          transform?: object,
          metadata?: object,
          files?: string[],
          ignores?: string[],
          url?: string
        },
        tests?: {
          valid: string[],
          invalid: string[]
        }
      }
    ]
  }
  Response (failed): { requestId, status: "failed", error: string }
  Response (403):     { error: "access_denied" }
  Response (404):     { error: "request_not_found" }
```

### Identity Endpoint (used for org resolution fallback)

```
GET /cli/api/whoami
  Headers:  Authorization: Bearer <access_token>
  Response (200): {
    user: string,
    email?: string,
    orgs: [{ orgId: number, name: string, installationId: number }]
  }
  Response (401): { error: "unauthorized" }
```

### Auth Endpoints (reference — implemented by cli-auth change)

```
POST /cli/auth/device      (start device flow)
POST /cli/auth/token       (poll for authorization)
GET  /cli/auth/verify      (browser-facing approval page)
```

### Discovery

```
GET /cli/api               (manifest of available endpoints, no auth)
```

All `/cli/api/*` endpoints support `x-explain: 1` header — returns JSON schema of request/response instead of executing (no auth required).
