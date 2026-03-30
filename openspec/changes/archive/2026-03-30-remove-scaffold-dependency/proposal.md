# Remove Scaffold Dependency

## Problem

The `.taskless/` scaffold — `taskless.json`, `sgconfig.yml`, and the `update-engine` command — causes more onboarding friction than it solves. Developers must have the scaffold in place before they can create rules or run checks, and upgrading it requires a backend-generated PR for what amounts to a version string bump. Meanwhile, the CLI already knows (or can infer) everything the scaffold provides:

- **`orgId`**: Available from the JWT once auth v2 ships (TSKL-212)
- **`repositoryUrl`**: Inferrable from `git remote get-url origin`
- **`sgconfig.yml`**: Static content (`ruleDirs: [rules]`) that the CLI can generate at check time
- **`version`**: A scaffold feature gate that becomes unnecessary when the CLI owns its own config

The backend team is simultaneously removing their scaffold generation and onboarding PR systems (see Backend Team Contract below), making this the right time to cut the dependency.

## Solution

Make the CLI self-sufficient. The `.taskless/` directory becomes an artifact of having rules, not a setup prerequisite.

### What changes

1. **Auth moves to per-repository JWT in `.taskless/.env.local.json`** (gitignored). The JWT includes an `orgId` claim, decoded locally via `jose`. No config file needed for identity.

2. **`sgconfig.yml` becomes ephemeral**. The CLI generates it into `.taskless/` (gitignored) at check time. Same file, same location, just CLI-owned and not committed.

3. **`taskless.json` is obsolete**. No longer read or required. Existing files are harmless but ignored by new CLI versions.

4. **`update-engine` command is removed**. The backend endpoints are being decommissioned. CLI version is the only version that matters going forward.

5. **`MIN_SCAFFOLD_VERSION` and version gating are removed**. No scaffold version to gate on.

6. **`.taskless/.gitignore` is CLI-managed**. The CLI proactively creates/maintains it to ignore `.env.local.json` and `sgconfig.yml`.

7. **`repositoryUrl` is inferred from git remote**, canonicalized to `https://github.com/{owner}/{repo}`.

### New `.taskless/` directory model

```
.taskless/
├── .gitignore        ← CLI-managed (ignores local files)
├── .env.local.json   ← per-repo auth token (gitignored)
├── sgconfig.yml      ← ephemeral, generated at check time (gitignored)
├── rules/            ← committed, written by CLI or backend PRs
├── rule-tests/       ← committed, written by CLI or backend PRs
└── rule-metadata/    ← committed, written by CLI
```

### Identity resolution flow

```
resolveIdentity():
  1. Read JWT from .env.local.json (or TASKLESS_TOKEN env var)
  2. Decode JWT via jose (no verification — just reading claims)
  3. If JWT has orgId claim → use it
     Else → token is stale, prompt re-login
  4. Infer repositoryUrl from `git remote get-url origin`
  → return { orgId, repositoryUrl }
```

### Lifecycle changes

| User action       | Before                                    | After                                                      |
| ----------------- | ----------------------------------------- | ---------------------------------------------------------- |
| First setup       | Scaffold must exist (backend PR)          | Just `tskl auth login`                                     |
| Create first rule | Requires scaffold + config                | `tskl rules create` (creates `.taskless/rules/` as needed) |
| Run check         | Requires `taskless.json` + `sgconfig.yml` | Just needs `.taskless/rules/` to exist                     |
| Upgrade scaffold  | `tskl update-engine` → backend PR → merge | Not needed (CLI self-manages)                              |

## Non-goals

- **Changing the rule file format or location** — rules stay in `.taskless/rules/*.yml`
- **Changing the API contract for rule generation** — `POST /cli/api/rule` is unchanged
- **Maintaining `taskless.json` fallback for orgId** — stale tokens prompt re-login instead
- **Migration scripting** — existing repos continue to work; `taskless.json` is ignored, not deleted

## Dependencies

- **Backend auth v2**: JWT with `orgId` claim from `POST /cli/auth/token`. The backend team is working on this as part of TSKL-212. CLI-side work (removing scaffold reads, ephemeral sgconfig, removing update-engine) can start in parallel.
- **`jose` package**: New dependency for JWT decoding.

## Risks

- **Git remote inference may fail** in repos without an `origin` remote or with non-GitHub URLs. Need a fallback or clear error message.
- **Existing users must re-authenticate**: Users with pre-v2 tokens will be prompted to re-login when running identity-dependent commands. One-time friction, clear error message.

## Specs affected

| Spec                | Impact                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `cli`               | Remove `update-engine` subcommand registration, remove `MIN_SCAFFOLD_VERSION`, remove scaffold version validation    |
| `cli-auth`          | Add per-repo token storage in `.env.local.json`, add JWT decoding with `jose`, add `.taskless/.gitignore` management |
| `cli-check`         | Remove `taskless.json` validation, generate ephemeral `sgconfig.yml`, handle missing `.taskless/` gracefully         |
| `cli-rules`         | Replace `taskless.json` reads with JWT + git remote identity resolution                                              |
| `cli-rules-api`     | No changes (server-side contract unchanged except auth token now carries orgId)                                      |
| `cli-update-engine` | Archive entire spec                                                                                                  |

## Backend team contract (reference)

The backend team is simultaneously:

- Adding `orgId` claim to the JWT issued during device authorization
- Removing `POST /cli/api/update-engine` and `GET /cli/api/update-engine/:requestId`
- Removing scaffold/onboarding PR generation
- Removing ownership of `sgconfig.yml` and `taskless.json`

The backend expects the CLI to:

- Store auth per-repository (not globally)
- Infer `repositoryUrl` from git remote
- Extract `orgId` from the JWT
- Generate `sgconfig.yml` locally at check time
- Warn if `.taskless/.auth` (now `.env.local.json`) is tracked in git
