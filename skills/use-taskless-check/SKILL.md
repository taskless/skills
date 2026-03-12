---
name: use-taskless-check
description: Checks a repository using the Taskless rules via the CLI. Use when the user wants to run a check, test rules, or validate code against taskless rules. Trigger on "check my code", "run taskless check", "test my rules", or "validate with taskless".
metadata:
  author: taskless
  version: 0.1.4
  commandName: taskless:check
compatibility: Designed for Agents implementing the Agent Skills specification.
---

# Taskless Check

When this skill is invoked, perform a check of the codebase using the Taskless CLI and report the results.

## Instructions

1. **Read current command documentation.** Run `pnpm dlx @taskless/cli@latest help check` and read the output. Use this to understand the command's options, output format, and exit codes.

2. **Invoke the CLI with JSON output.** Run `pnpm dlx @taskless/cli@latest check --json` and capture stdout.

3. **Parse the response.** Parse the JSON output with `JSON.parse()`. Use the fields described in the help output to determine success or failure and report any issues found to the user.

4. **Handle errors.** If the command exits with a non-zero code or the output is not valid JSON, report the error and suggest running `taskless init` if configuration is missing.
