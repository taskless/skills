---
name: "Taskless: Logout"
description: Explains how to remove saved Taskless authentication. Use when the user wants to log out, disconnect, remove credentials, or clear their Taskless session. Trigger on "taskless logout", "disconnect taskless", or "remove taskless auth".
category: Taskless
tags:
  - taskless
metadata:
  author: taskless
  version: 0.1.5
  commandName: tskl:logout
---

# Taskless Logout

When this skill is invoked, explain how to remove saved authentication and provide the CLI command.

**Important:** Do NOT attempt to run the logout command. Provide the command for the user to run in their terminal.

## Instructions

1. **Read current command documentation.** Run `pnpm dlx @taskless/cli@latest help auth logout` and read the output. Use this to understand what the command does, credential storage location, and any caveats.

2. **Present the logout command and explain what it does.** Using the information from the help output, display the command the user should run and explain the effects (credential removal, environment variable note).
