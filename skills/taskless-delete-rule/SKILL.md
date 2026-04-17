---
name: taskless-delete-rule
description: Deletes a Taskless rule and its test files. Use when the user wants to remove a rule, delete a lint rule, or clean up an unwanted rule. Trigger on "delete rule", "remove taskless rule", "delete this rule", or "remove rule".
metadata:
  author: taskless
  version: 0.6.0
  commandName: "-"
compatibility: Designed for Agents implementing the Agent Skills specification.
---

# Taskless Rule Delete

When this skill is invoked, help the user identify which rule to delete, confirm the selection, and invoke the CLI to remove it.

## Instructions

**Package manager:** All commands below use `npx` as the default. If the project uses a different package manager (check for `pnpm-lock.yaml`, `yarn.lock`, or `bun.lockb`), prefer its equivalent: `pnpm dlx`, `yarn dlx` (Yarn Berry/2+ only), or `bunx`.

1. **Read current command documentation.** Run `npx @taskless/cli@latest help rules delete` and read the output. Use this to understand the command's arguments, options, and exit codes.

2. **List available rules.** Scan the `.taskless/rules/` directory for `.yml` files. Present the rule IDs (filenames without the `.yml` extension) to the user.

   If no rules are found, inform the user:

   ```
   No rules found in .taskless/rules/. There are no rules to delete.
   ```

3. **Identify the target rule.** If the user already specified a rule (e.g., "delete the console-log rule"), match it to an available rule ID. If the match is ambiguous or unclear, ask the user to clarify which rule they mean.

4. **Confirm before deleting.** Show the user the rule ID and ask for confirmation before proceeding.

5. **Invoke the CLI.** Run the delete command using the syntax shown in the help output (e.g., `npx @taskless/cli@latest rules delete <id>`).

6. **Report the result.** Confirm which files were deleted.

7. **Handle errors.** If the CLI reports the rule was not found, inform the user and suggest checking the rule ID.
