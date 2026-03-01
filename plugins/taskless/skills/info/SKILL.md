---
name: info
description: Confirms that the Taskless skills plugin is installed and working. Use when the user wants to verify their Taskless setup, check plugin status, test the connection, or run a health check. Trigger on "is taskless working", "check taskless", "taskless status", or "taskless info".
metadata:
  author: taskless
  version: "1.0"
compatibility: Designed for Agents implementing the Agent Skills specification.
---

# Taskless Info

When this skill is invoked, verify that the Taskless CLI is reachable and report its version.

## Instructions

1. **Detect the package manager.** Check if `pnpm-lock.yaml` exists in the project root.
   - If it exists, use `pnpm dlx` as the runner.
   - Otherwise, use `npx` as the runner.

2. **Invoke the CLI.** Run the following command and capture stdout:
   - pnpm: `pnpm dlx @taskless/cli@latest info`
   - npm: `npx @taskless/cli@latest info`

3. **Parse the response.** The CLI outputs a single line of JSON to stdout:
   ```json
   {"version":"0.0.1"}
   ```
   Parse this with `JSON.parse()` and extract the `version` field.

4. **Report the result.** Display a confirmation message with the version:
   ```
   Taskless skills plugin is installed and working.
   CLI version: <version>
   ```

5. **Handle errors.** If the command fails (non-zero exit code) or the output is not valid JSON:
   - Report that the Taskless CLI could not be reached.
   - Suggest checking network connectivity and that npm/pnpm is available.
   - Show the raw error output if available.

## Example Output

```
Taskless skills plugin is installed and working.
CLI version: 0.0.1
```
