## Why

The CLI currently operates entirely offline. To support future features — publishing skills, pulling private skills, and interacting with taskless.io APIs — the CLI needs to know who the user is. This change adds an authentication flow modeled after `gh auth login` and `npm login`, using the OAuth Device Flow (RFC 8628) so it works in SSH sessions, containers, and WSL environments.

## What Changes

- Add `taskless auth login` subcommand that initiates a Device Flow, polls for authorization, and saves the resulting token
- Add `taskless auth logout` subcommand that removes the saved token
- Store tokens in the user's XDG config directory (`$XDG_CONFIG_HOME/taskless/auth.json`, defaulting to `~/.config/taskless/auth.json`)
- Support a `TASKLESS_TOKEN` environment variable as an override for CI/headless environments
- Extend the `taskless info` output with a `loggedIn` boolean indicating whether a token is currently saved
- Define the API contract that taskless.io must implement to support the Device Flow (documented for the API team, not implemented here)

## Capabilities

### New Capabilities

- `cli-auth`: Covers the `auth login` and `auth logout` subcommands, the Device Flow orchestration, and the token persistence layer (XDG-compliant file storage + env var override)
- `cli-auth-api`: Documents the server-side API contract (device authorization endpoint, token endpoint, whoami endpoint) that taskless.io must implement. This is a spec-only capability — no implementation in this repo.

### Modified Capabilities

- `cli`: The info subcommand output gains a `loggedIn` field. The main CLI command registers the `auth` subcommand group.

## Impact

- **packages/cli/**: New `auth` subcommand with `login` and `logout` handlers. New token storage module. Modified `info` output.
- **plugins/taskless/**: A `/taskless:auth` skill can be added to wrap the CLI auth flow for use inside Claude Code (optional, can be a follow-up).
- **External dependency**: The actual Device Flow HTTP calls depend on taskless.io implementing the endpoints defined in `cli-auth-api`. Until then, the CLI can stub the network layer behind an interface.
- **No breaking changes**: All existing commands continue to work unchanged.
