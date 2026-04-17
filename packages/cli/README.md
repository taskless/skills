# @taskless/cli

> A Work in Progress

CLI companion for [Taskless](https://taskless.io). Designed to be invoked by skills via `npx` or `pnpm dlx`. Useful for agents, and works for humans too.

## Usage

```bash
# npm
npx @taskless/cli@latest info

# pnpm
pnpm dlx @taskless/cli@latest info
```

## Commands

### `taskless info`

Outputs CLI version, tool status, and login info as JSON to stdout:

```json
{
  "version": "0.0.3",
  "tools": [],
  "loggedIn": true,
  "auth": { "user": "jake", "email": "jake@example.com", "orgs": ["my-org"] }
}
```

### `taskless init`

Launches an interactive wizard that detects supported tool directories in the
current project (`.claude/`, `.opencode/`, `.cursor/`, `.agents/`), lets you
pick which ones to install into, optionally includes the `taskless-ci` skill,
and walks through the auth tradeoff before writing anything. Running `taskless`
with no subcommand in a TTY also launches this wizard.

For CI and scripted installs, pass `--no-interactive` to skip all prompts.
This installs every mandatory skill to every detected tool, or falls back to
`.agents/skills/` when no tools are detected:

```bash
taskless init                    # interactive wizard (default in a TTY)
taskless init --no-interactive   # scripted install, no prompts
```

The wizard records what it installed in `.taskless/taskless.json` so later
runs can compute a diff and surgically remove files that are no longer
selected. Cancelling the wizard at any step (Ctrl-C) aborts cleanly with no
filesystem changes.

### `taskless check`

Run ast-grep rules from `.taskless/rules/` against the codebase. Exits with code 1 if any error-severity matches are found.

```bash
taskless check          # human-readable output
taskless check --json   # JSONL output
```

### `taskless auth login` / `taskless auth logout`

Authenticate with taskless.io using the device flow. Tokens are stored in `~/.config/taskless/auth.json`.

### `taskless rules create`

Generate ast-grep rules via the taskless.io API. Reads a JSON request from stdin, submits it, polls for results, and writes rule and test files to `.taskless/rules/` and `.taskless/rule-tests/`.

```bash
echo '{"prompt": "detect console.log usage"}' | taskless rules create
echo '{"prompt": "find innerHTML assignments", "language": "typescript"}' | taskless rules create --json
```

Requires authentication and a `.taskless/taskless.json` with `orgId` and `repositoryUrl`.

### `taskless rules delete <id>`

Remove a rule file and its associated test files from disk. No authentication required.

```bash
taskless rules delete no-console-log
```

### `taskless --help`

Lists available subcommands.

## For skill authors

Skills should detect the package manager by checking for lock files and invoke the CLI accordingly:

1. If `pnpm-lock.yaml` exists, use `pnpm dlx @taskless/cli@latest <command>`
2. Otherwise, use `npx @taskless/cli@latest <command>`

All commands output structured JSON to stdout by default. Parse with `JSON.parse()` and handle non-zero exit codes as errors.

## Developing

### API base URL

The CLI resolves the API base URL in this order:

1. `TASKLESS_API_URL` env var
2. `~/.config/taskless/config.json` → `apiUrl` field
3. Default: `https://app.taskless.io/cli`

For local development against the taskless.io app:

```bash
TASKLESS_API_URL=http://localhost:5173/cli taskless info
```

### API schema introspection

All `/cli/api/*` endpoints support the `x-explain: 1` header. When present, the endpoint returns its JSON schema instead of executing — no authentication required.

```bash
# List available endpoints
curl -s -H "x-explain: 1" http://localhost:5173/cli/api

# Get the schema for rule generation
curl -s -H "x-explain: 1" -X POST http://localhost:5173/cli/api/rule

# Get the schema for rule status polling
curl -s -H "x-explain: 1" http://localhost:5173/cli/api/rule/any-id

# Get the schema for whoami
curl -s -H "x-explain: 1" http://localhost:5173/cli/api/whoami
```

This is useful for verifying that CLI types align with the production API contract.
