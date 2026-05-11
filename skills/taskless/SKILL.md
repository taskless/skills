---
name: taskless
description: |
  Use for any Taskless task. Trigger when the user mentions Taskless by name,
  or when their request involves the .taskless/ directory or files in it
  (rules, rule-tests, rule-metadata).

  Specifically:
  - "create/add/write a taskless rule for X"
  - "improve/fix/iterate on this taskless rule"
  - "delete/remove this taskless rule"
  - "run taskless", "taskless check", "validate against taskless rules"
  - "taskless login/logout/status", "is taskless connected"
  - "add taskless to CI", "wire taskless into github actions"

  Do NOT trigger on generic ESLint, linting, or rule requests that don't
  reference Taskless or .taskless/ files.
metadata:
  author: taskless
  version: 0.6.0
  commandName: tskl
compatibility: Designed for Agents implementing the Agent Skills specification.
---

# Taskless

You do NOT have the steps for any Taskless action in your context. The current
canonical recipes live behind `npx @taskless/cli help <topic>`. Always fetch
the recipe first; do not improvise from prior knowledge — recipes change with
each CLI version.

## First step: confirm Taskless is installed here

If the working directory does not contain a `.taskless/` directory, ask the
user to confirm they meant Taskless (vs. ESLint or another tool). If they
confirm, offer to run `npx @taskless/cli` to install. Otherwise, stop.

## Topics

| User wants                 | Topic                                 |
| -------------------------- | ------------------------------------- |
| Install or update          | tell user to run `npx @taskless/cli`  |
| Create a new rule          | `npx @taskless/cli help rule create`  |
| Improve an existing rule   | `npx @taskless/cli help rule improve` |
| Delete a rule              | `npx @taskless/cli help rule delete`  |
| Check code against rules   | `npx @taskless/cli help check`        |
| Log in, log out, or status | `npx @taskless/cli help auth`         |
| Wire into CI               | `npx @taskless/cli help ci`           |

If the user's intent is ambiguous between two topics, run
`npx @taskless/cli help` (no args) to see the disambiguation table, or ask
the user.

## --anonymous

Any rule/check command accepts `--anonymous` to skip the Taskless API and
use local-only behavior. When the user is offline OR explicitly asks for
anonymous mode, fetch the recipe with
`npx @taskless/cli help <topic> --anonymous`, which returns the local-only
flow (when one exists for that topic).

## First-run latency

The first invocation of `npx @taskless/cli` on a machine pays an npm
cold-fetch (~5–15 seconds). This is normal — do not report it as a timeout
or failure. Subsequent invocations are cached and fast.
