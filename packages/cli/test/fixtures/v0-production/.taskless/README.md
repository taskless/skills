# Taskless

This directory contains [Taskless](https://taskless.io) configuration and rules for static analysis.

## Usage

Run the Taskless scanner from your repository root:

```sh
# npm / pnpm
pnpm dlx @taskless/cli@latest check

# npx
npx @taskless/cli@latest check
```

## Files

- `taskless.json` — Version manifest and CLI requirements
- `sgconfig.yml` — ast-grep project configuration
- `rules/` — Generated ast-grep rules (managed by Taskless)
