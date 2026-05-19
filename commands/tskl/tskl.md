---
name: "Taskless"
description: Run any Taskless action — create/improve/delete a rule, run check, manage auth, or wire CI. Routes via `npx @taskless/cli help <topic>` to fetch the canonical recipe and follow it.
category: Taskless
argument-hint: <describe what you want to do>
tags:
  - taskless
metadata:
  author: taskless
  commandName: tskl
---

# Taskless

The user invoked Taskless via `/tskl` with: $ARGUMENTS

If `$ARGUMENTS` is empty or ambiguous, ask the user what they want to do
with Taskless before proceeding.

Otherwise, follow the same flow as the `taskless` skill:

1. Identify the topic from `$ARGUMENTS` using the table below.
2. Fetch the canonical recipe with `npx @taskless/cli help <topic>` (or
   `npx @taskless/cli help <topic> --anonymous` if the user is offline or
   explicitly asked for anonymous mode).
3. Follow the recipe step-by-step. The recipe is canonical for the
   currently-installed CLI version; do not improvise from prior knowledge.

## Topics

| User wants                 | Topic                                 |
| -------------------------- | ------------------------------------- |
| Update Taskless skills     | run `npx @taskless/cli update`        |
| Create a new rule          | `npx @taskless/cli help rule create`  |
| Improve an existing rule   | `npx @taskless/cli help rule improve` |
| Delete a rule              | `npx @taskless/cli help rule delete`  |
| Check code against rules   | `npx @taskless/cli help check`        |
| Log in, log out, or status | `npx @taskless/cli help auth`         |
| Wire into CI               | `npx @taskless/cli help ci`           |

If unsure, run `npx @taskless/cli help` (no args) for the topic
disambiguation table.
