## Why

The CLI can check rules (`taskless check`) but has no way to create them. Users need a CLI-driven path to generate ast-grep rules via the taskless.io rule generation API (`POST /cli/api/request`). This enables a skill-to-CLI workflow where conversational AI tools gather intent and the CLI handles authenticated API calls, polling, and deterministic file writing.

## What Changes

- Add `taskless rules create` subcommand that reads a rule request from stdin, resolves `orgId` and `repositoryUrl` from `.taskless/taskless.json`, submits to `POST /cli/api/request`, polls `GET /cli/api/request/:requestId` for results, and writes generated rule and test files to `.taskless/rules/` and `.taskless/rule-tests/`
- Add `taskless rules delete <id>` subcommand that removes a rule file and its associated test files locally (no API call)
- Require a new minimum spec version for `taskless.json` that includes `orgId` and `repositoryUrl` fields
- Document the API contract (`POST /cli/api/request`, `GET /cli/api/request/:requestId`, `GET /cli/api/whoami`) for reference
- Establish the principle that skills always delegate execution to the CLI — skills gather intent, the CLI does the work

## Capabilities

### New Capabilities

- `cli-rules`: Covers the `rules create` and `rules delete` subcommands, request-based polling for async rule generation, and file writing for rules and rule tests
- `cli-rules-api`: Documents the server-side API contract (`/cli/api/request`, `/cli/api/request/:requestId`, `/cli/api/whoami`, `/cli/api` manifest) that taskless.io implements. Spec-only — no implementation in this repo.

### Modified Capabilities

- `cli`: The main CLI command registers the `rules` subcommand group. New compatibility range for spec versions requiring `orgId`/`repositoryUrl` in `taskless.json`.

## Impact

- **packages/cli/**: New `rules` subcommand group with `create` and `delete` handlers. New actions for API submission and request polling. New project config reader for `orgId`/`repositoryUrl`. New compatibility range in `capabilities.ts`.
- **`.taskless/taskless.json`**: Requires `orgId` (number) and `repositoryUrl` (string) fields at the new spec version. Existing projects need to update their config.
- **plugins/taskless/**: A skill can be added to wrap the CLI rules flow for use inside Claude Code (follow-up change, not part of this).
- **External dependency**: The `rules create` command depends on taskless.io implementing the endpoints documented in `cli-rules-api`. The network layer is stubbed behind an interface until live (same pattern as auth).
- **No breaking changes to existing commands**: `check`, `init`, `info`, `auth` continue to work unchanged. Only `rules create` requires the new spec version.
