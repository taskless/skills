---
name: "Taskless: Info"
description: Confirms that the Taskless skills plugin is installed and working. Use when the user wants to verify their Taskless setup, check plugin status, test the connection, or run a health check. Trigger on "is taskless working", "check taskless", "taskless status", or "taskless info".
category: Taskless
tags:
  - taskless
metadata:
  author: taskless
  version: 0.4.0
  commandName: tskl:info
---

# Taskless Info

When this skill is invoked, verify that the Taskless CLI is reachable and report its version.

## Instructions

1. **Read current command documentation.** Run `pnpm dlx @taskless/cli@latest help info` and read the output. Use this to understand the command's output format and available options.

2. **Invoke the CLI.** Run `pnpm dlx @taskless/cli@latest info` and capture stdout.

3. **Parse the response.** The CLI outputs JSON to stdout. Parse it with `JSON.parse()` and extract the fields described in the help output. Key fields to report:
   - `version`: The version of the Taskless CLI.
   - `tools`: An array of coding agent tools with their installed skills and versions.
   - `loggedIn`: Indicates if the user is logged into Taskless.

4. **Report the result.** Display a confirmation message with the version:

   ```
   Taskless skills plugin is installed and working.
   CLI version: <version>

   Tools:
   - <Tool Name>
     - <Skill Name>: Installed version <installedVersion>, Current version <currentVersion>, Up to date: <current as "YES" or "NO">
   ...
   ```

5. **Handle errors.** If the command fails (non-zero exit code) or the output is not valid JSON:
   - Report that the Taskless CLI could not be reached.
   - Suggest checking network connectivity and that npm/pnpm is available.
   - Show the raw error output if available.

6. **Report if Upgrade is Required** If any installed skill is not current, include a note that an upgrade is recommended. Offer to run `pnpm dlx @taskless/cli@latest init` for them to reinitialize with the latest skills.

## Example Output

```
Taskless skills plugin is installed and working.
CLI version: 0.0.1
```
