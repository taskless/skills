# @taskless/cli

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

Outputs CLI version as JSON to stdout:

```json
{ "version": "0.0.1" }
```

### `taskless --help`

Lists available subcommands.

## For skill authors

Skills should detect the package manager by checking for lock files and invoke the CLI accordingly:

1. If `pnpm-lock.yaml` exists, use `pnpm dlx @taskless/cli@latest <command>`
2. Otherwise, use `npx @taskless/cli@latest <command>`

All commands output structured JSON to stdout by default. Parse with `JSON.parse()` and handle non-zero exit codes as errors.
