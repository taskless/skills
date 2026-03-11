## Context

The CLI currently aliases `update` to `init` (same command object in `index.ts`). The `init` command reinstalls skills and commands but never touches `.taskless/taskless.json`. When `rules create` detects a stale spec version, it tells users to "re-run taskless init" — which doesn't fix the problem.

Version compatibility is currently split across three concepts: `COMPATIBILITY` ranges (start/end pairs), `RULES_MIN_SPEC_VERSION`, and `isRulesCompatibleVersion()`. These should collapse into a single per-subcommand minimum version map.

Meanwhile, the `rules create` command only accepts JSON via stdin pipe. The `taskless-rule-create` skill constructs `echo '<json>' | ...` commands, which break in zsh (where `echo` interprets `\n` as literal newlines, corrupting JSON string values). Heredocs work but create compound commands that may be blocked by agent settings.

The backend team is building `POST /cli/api/update-engine` and `GET /cli/api/update-engine/:requestId` endpoints that generate scaffold upgrade PRs server-side via the GitHub App.

## Goals / Non-Goals

**Goals:**

- Replace `COMPATIBILITY` ranges with a per-subcommand minimum scaffold version map
- Give users a working path from "stale scaffold" to "current" via `taskless update-engine`
- Replace stdin JSON input on `rules create` with `--from <file>` flag
- Update error messages and skills to reference `taskless update-engine`
- Implement the update-engine API calls against the finalized backend endpoints (PR #18); retain stub provider for offline/test use

**Non-Goals:**

- Client-side scaffold modification (the backend opens a PR for safety)
- Changing the `init` command behavior (it remains skill-only installation)
- Building a reusable polling abstraction (simple fetch loop is sufficient)
- Maintaining backward compatibility for stdin input (clean break)
- API calls for version checking (purely local, per the backend team's recommendation)

## Decisions

### Decision 1: Per-subcommand minimum scaffold versions replace COMPATIBILITY ranges

Replace the current `COMPATIBILITY` array, `RULES_MIN_SPEC_VERSION`, `isRulesCompatibleVersion()`, and `isSupportedSpecVersion()` with a single map:

```typescript
const MIN_SCAFFOLD_VERSION: Record<string, string> = {
  "rules create": "2026-03-03",
  check: "2026-02-18",
};
```

Each subcommand declares its own floor. On invocation, the CLI reads `version` from `.taskless/taskless.json`, compares against the subcommand's minimum (string comparison — YYYY-MM-DD sorts correctly), and fast-fails with a clear message if below:

> Scaffold version 2026-03-02 is below the minimum 2026-03-03 required for 'taskless rules create'. Run 'taskless update-engine' to update.

**Why this model?**

- Zero API calls for version checking — purely local
- The CLI never needs to know the "latest" version, only what it needs
- Each CLI release naturally raises the floor as new features require newer scaffolds
- The backend is still the authority on whether an update is truly needed (returns `current` if the repo's version is actually fine)

**What it replaces:**

- `COMPATIBILITY` array with start/end ranges → gone
- `RULES_MIN_SPEC_VERSION` constant → absorbed into the map
- `isRulesCompatibleVersion()` → replaced by generic `isScaffoldVersionSufficient(command, version)`
- `isSupportedSpecVersion()` → replaced by checking if version >= lowest minimum in the map
- `validateRulesConfig()` version check → uses the generic check

### Decision 2: `update-engine` is a new command; `update` alias for `init` is removed

Currently `index.ts` maps `update: initCommand`. This changes to `"update-engine": updateEngineCommand` pointing to a new `commands/update-engine.ts`. The `update` alias for `init` is removed to avoid confusion — `init` installs skills, `update-engine` upgrades the `.taskless/` engine directory via backend PR.

**Why `update-engine`?** It's consistent with the `init`/`update` verb family while clearly scoping what's being updated. `init`/`update` handle skills and commands; `update-engine` handles the `.taskless/` engine directory.

### Decision 3: `--from <file>` replaces stdin entirely on `rules create`

Remove the `readStdin()` path. The `--from` argument becomes required. When not provided, the CLI prints an error with usage examples showing `--from`.

**Why remove stdin?** The stdin path is the root cause of the shell escaping bug. Since skills read `help` output for invocation examples, keeping `help` up to date with `--from` syntax is sufficient. No existing users depend on stdin since the feature hasn't shipped broadly yet.

**Alternative considered:** Keep both paths. Rejected to reduce testing surface and eliminate the class of bugs entirely.

### Decision 4: Follow the `rule-api.ts` provider pattern for the update-engine API

Create `update-api.ts` with an `UpdateApiProvider` interface, `HttpUpdateApiProvider`, and `StubUpdateApiProvider`. The stub throws a clear error. The provider is selected based on `getApiBaseUrl()` availability (same pattern as `ruleApiProvider`).

**API endpoints:** `POST /cli/api/update-engine` and `GET /cli/api/update-engine/:requestId` (per backend team naming).

**API shape finalized** (per backend PR #18): POST returns `current` | `exists` (with `requestId` + `prUrl`) | `accepted` (with `requestId`, HTTP 202). GET returns `pending` | `open` (with `prUrl`) | `merged` (with `prUrl`) | `closed` (with `prUrl`). Field is `prUrl` throughout (not `pr`). No `from`/`to` version fields.

### Decision 5: Update-engine command is non-blocking

The CLI POSTs to `/cli/api/update-engine`, polls until the PR is created (or an immediate status is returned), then prints the PR URL and exits. It does NOT block waiting for the PR to be merged.

**Why not block?** The merge is a human action that could take minutes to days. Blocking the CLI (and the agent using it) serves no purpose.

**What about merged detection?** When a subcommand detects a stale version AND the update-engine API reports `status: "merged"` or `status: "exists"`, the CLI should tell the user to pull/update their branch to pick up the changes.

### Decision 6: Subcommands offer to run `taskless update-engine` on stale version

When scaffold version is below the subcommand's minimum, the CLI checks if it's running interactively (TTY). If interactive, it asks "Run `taskless update-engine` to fix this? [y/N]". If non-interactive (piped/agent), it just prints the error with instructions.

**Why conditional?** Agents invoke the CLI non-interactively. The skill itself should decide whether to run update-engine, not the CLI prompting stdin.

### Decision 7: Skill uses `--from` with a temp file

The `taskless-rule-create` skill writes the JSON payload to a file (e.g., `.taskless/.tmp-rule-request.json`), then runs `pnpm dlx @taskless/cli@latest rules create --from .taskless/.tmp-rule-request.json --json`. This is a single, simple command with no shell escaping concerns.

**Why `.taskless/` for the temp file?** It's already gitignored in typical setups and is the natural home for Taskless-related files. The skill should clean up the file after the command completes.

## Risks / Trade-offs

**[Risk] Backend API deployment timing** → Backend PR #18 finalizes the API. Stub provider is retained for offline/test scenarios. No different from the current rule API stub pattern.

**[Risk] PR-based update has latency** → Users must wait for the PR to be created (seconds), then merge it, then pull. This is intentional — the backend team chose PR-based updates to prevent destructive local file changes without user signoff.

**[Risk] Agent deny-lists block the skill's CLI invocation** → The `--from` approach produces a single, simple command (`taskless rules create --from file.json`). No pipes, no heredocs, no compound commands. This should pass standard deny-list configurations.

**[Risk] `--from` file left behind on error** → The skill should clean up the temp file in a finally block. If it's missed, it's a small JSON file in `.taskless/` that won't cause harm.

**[Trade-off] Removing stdin is a breaking change** → Acceptable because the feature hasn't shipped broadly. The `--from` flag is strictly better for the use cases we support (skill invocation, scripting).

**[Trade-off] Per-subcommand map grows with each feature** → This is by design. Each new feature that needs a newer scaffold simply adds an entry. The map is small, explicit, and easy to reason about.
