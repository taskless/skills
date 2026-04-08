---
name: taskless-logout
description: Explains how to remove saved Taskless authentication. Use when the user wants to log out, disconnect, remove credentials, or clear their Taskless session. Trigger on "taskless logout", "disconnect taskless", or "remove taskless auth".
metadata:
  author: taskless
  version: 0.5.2
  commandName: tskl:logout
compatibility: Designed for Agents implementing the Agent Skills specification.
---

# Taskless Logout

When this skill is invoked, explain how to remove saved authentication and provide the CLI command.

**Important:** Do NOT attempt to run the logout command. Provide the command for the user to run in their terminal.

## Instructions

**Package manager:** All commands below use `npx` as the default. If the project uses a different package manager (check for `pnpm-lock.yaml`, `yarn.lock`, or `bun.lockb`), prefer its equivalent: `pnpm dlx`, `yarn dlx` (Yarn Berry/2+ only), or `bunx`.

1. **Read current command documentation.** Run `npx @taskless/cli@latest help auth logout` and read the output. Use this to understand what the command does, credential storage location, and any caveats.

2. **Present the logout command and explain what it does.** Using the information from the help output, display the command the user should run and explain the effects (credential removal, environment variable note).
