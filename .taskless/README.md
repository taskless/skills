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

- `taskless.json` - Version manifest / migration state
- `.env.local.json` - Local authentication credentials (git-ignored)
- `rules/` - Generated ast-grep rules (managed by Taskless)
- `rule-tests/` - Rule tests containing pass/fail examples for your rules
