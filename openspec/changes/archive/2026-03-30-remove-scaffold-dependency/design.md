## Context

The CLI currently requires a `.taskless/` scaffold (containing `taskless.json` and `sgconfig.yml`) to be present before any commands work. This scaffold is created by the backend via onboarding PRs and upgraded via `update-engine` PRs. The backend team is removing their scaffold generation system (TSKL-212), and the CLI needs to become self-sufficient.

Today's identity resolution reads `orgId` and `repositoryUrl` from `taskless.json`. Auth tokens are stored globally at `~/.config/taskless/auth.json`. The `check` command requires both `taskless.json` (for version validation) and `sgconfig.yml` (for ast-grep configuration). The `update-engine` command calls backend endpoints that are being decommissioned.

## Goals / Non-Goals

**Goals:**

- Remove CLI dependency on `taskless.json` and backend-generated `sgconfig.yml`
- Move identity resolution to JWT claims (`orgId`) and git remote inference (`repositoryUrl`)
- Remove the `update-engine` command and scaffold version gating
- Add per-repository auth token storage in `.taskless/.env.local.json`
- Make `.taskless/` a consequence of having rules, not a setup prerequisite
- Maintain backwards compatibility during a transition period

**Non-Goals:**

- Changing rule file format, location, or the rule generation API contract
- Implementing JWT signature verification (decode-only via `jose`)
- Building migration tooling to clean up existing `taskless.json` files
- Changing the global `~/.config/taskless/auth.json` storage for non-repo contexts (e.g., `TASKLESS_TOKEN` env var)

## Decisions

### [Decision 1]: Per-repo auth in `.taskless/.env.local.json` over `.taskless/.auth`

The backend contract proposed `.taskless/.auth`. We use `.env.local.json` instead because:

- The `.env.local` convention signals "local, not committed" — a pattern developers already recognize
- JSON format is extensible for future local CLI config without creating new files
- The backend doesn't depend on this filename; they only care that auth is per-repo and gitignored

**Alternatives considered:**

- `.taskless/.auth` (backend suggestion): Less discoverable, no convention signaling, not extensible
- `.taskless/config.local.json`: Viable but `.env.local` is more widely understood as "local overrides"

### [Decision 2]: Decode JWT with `jose` (no verification) over server-side identity call

We add `jose` as a dependency and use `decodeJwt()` to extract the `orgId` claim from the stored token. No signature verification is performed because:

- The token was obtained through our own device flow — we already trust it
- Verification would require fetching public keys, adding latency and a network dependency to offline commands
- The server validates the token on every API call anyway

**Alternatives considered:**

- Call `/cli/api/whoami` to resolve identity: Adds latency, requires network for every command
- Store `orgId` separately after login: Duplicates data, can drift from token

### [Decision 3]: Ephemeral `sgconfig.yml` generated in `.taskless/` (gitignored) over temp directory

The CLI generates `sgconfig.yml` at check time within `.taskless/` and gitignores it, rather than using a system temp directory because:

- ast-grep resolves `ruleDirs` relative to the config file location — keeping the config in `.taskless/` means the relative path `rules` works naturally
- Temp directories vary across operating systems and can be cleaned unexpectedly
- The file is tiny and deterministic; regenerating it is effectively free

**Alternatives considered:**

- System temp directory (`os.tmpdir()`): Requires absolute paths to rules, brittle across platforms
- Passing ast-grep flags directly instead of a config file: ast-grep's `--rule` flag works per-rule, not per-directory; `--config` is the correct entry point for directory-based scanning

### [Decision 4]: CLI-managed `.taskless/.gitignore` over root `.gitignore` entries

The CLI proactively creates/updates `.taskless/.gitignore` to ignore `.env.local.json` and `sgconfig.yml`. This is preferred over adding entries to the project's root `.gitignore` because:

- It's scoped to the `.taskless/` directory and doesn't pollute the project's gitignore
- It travels with the directory — if `.taskless/` is deleted, the gitignore goes with it
- The CLI can manage it without risk of conflicting with user-maintained gitignore entries

### [Decision 5]: Infer `repositoryUrl` from `git remote get-url origin` over configuration

The CLI runs `git remote get-url origin` and canonicalizes the result to `https://github.com/{owner}/{repo}` format. This is preferred over storing the URL in config because:

- It's always current — no config drift
- It's zero-configuration for the user
- SSH URLs (`git@github.com:...`) and HTTPS URLs both canonicalize to the same form

**Fallback**: If `origin` remote doesn't exist or the URL isn't a recognized GitHub URL, the CLI prints a clear error directing the user to set up a git remote. This is an edge case — virtually all Taskless users work in GitHub repos with an `origin` remote.

### [Decision 6]: Stale JWT without `orgId` prompts re-login (no `taskless.json` fallback)

If the JWT doesn't contain an `orgId` claim, the token predates auth v2 and is treated as stale. The CLI prompts the user to re-authenticate (`taskless auth login`) rather than falling back to `taskless.json`. This is simpler than maintaining a fallback code path and ensures users migrate to the new auth cleanly.

The backend API still accepts `orgId` in the request body (deprecated, no removal timeline), but new CLI versions stop sending it once they read from JWT. This means:

- No behavioral change on the backend — same endpoints, same request shapes
- `orgId` in the body becomes redundant once the JWT carries it
- The CLI can drop the body field immediately without coordination

**Alternatives considered:**

- Fall back to `taskless.json` for `orgId`: Adds a temporary code path, delays migration, and `taskless.json` may not exist in new repos anyway
- Send `orgId` in both JWT and body during transition: Unnecessary — backend already accepts both, and we can just stop sending the body field

## Risks / Trade-offs

**[Risk] Git remote inference fails in non-standard setups**
Some repos may not have an `origin` remote, or may use a non-GitHub URL (e.g., self-hosted GitLab, local-only repos). The CLI must provide clear error messages in these cases rather than silently failing.
_Mitigation_: Validate the remote URL against a known pattern (`github.com`). Print actionable error: "Could not determine repository URL from git remote. Ensure your repository has an 'origin' remote pointing to GitHub."

**[Risk] Existing users must re-authenticate after auth v2 ships**
Users with pre-v2 tokens will be prompted to re-login when running commands that need `orgId`. This is a one-time friction point.
_Mitigation_: Clear error message explaining why re-auth is needed: "Your auth token is missing organization info. Run `taskless auth login` to re-authenticate." This only triggers on commands that need identity (rules create/improve), not on `check`.

**[Risk] `jose` adds a new dependency**
Adding `jose` increases the bundle size. However, `jose` is a well-maintained, zero-dependency library focused on JWT/JWE/JWS operations. The bundle impact is minimal (~30KB) compared to the complexity of hand-rolling JWT decoding.

**[Risk] Per-repo auth tokens could be accidentally committed**
If `.taskless/.gitignore` fails to be created or is deleted, `.env.local.json` containing the JWT could be committed.
_Mitigation_: The CLI checks whether `.env.local.json` is tracked by git on every command that reads auth. If tracked, it prints a warning and suggests adding it to `.gitignore`.

## Migration Plan

1. **Phase 1 (CLI changes, no backend dependency)**:
   - Remove `update-engine` command and related code
   - Remove `MIN_SCAFFOLD_VERSION`, `isScaffoldVersionSufficient`, scaffold version validation
   - Make `check` generate ephemeral `sgconfig.yml` instead of reading it
   - Make `check` work without `taskless.json` (only requires `.taskless/rules/`)
   - Add `.taskless/.gitignore` management
   - Add `jose` dependency

2. **Phase 2 (after backend auth v2 ships)**:
   - Add per-repo token storage in `.taskless/.env.local.json`
   - Add JWT decoding for `orgId` extraction
   - Add git remote inference for `repositoryUrl`
   - Update `rules create` and `rules improve` to use new identity resolution
   - Add legacy `taskless.json` fallback for `orgId`

3. **Phase 3 (future CLI major version)**:
   - Remove `taskless.json` fallback
   - Remove any remaining scaffold-era code

## Open Questions

- **Q: Should the CLI warn when it detects a stale `taskless.json`?** It could print a one-time message suggesting deletion, but this adds noise. Leaning toward silent ignore — the file is harmless.
- **Q: Should `tskl auth login` prompt for repository selection if the user has multiple orgs?** The backend's `whoami` endpoint returns an array of orgs. If the JWT scopes to one org per token, this is moot. Need to confirm with backend team.
