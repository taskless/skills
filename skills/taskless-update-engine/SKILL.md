---
name: taskless-update-engine
description: Requests a scaffold upgrade for the .taskless/ engine directory. Use when the user needs to update their Taskless scaffold, upgrade their engine version, or when the CLI reports a stale scaffold version. Trigger on "update engine", "upgrade taskless", "taskless update-engine", or "scaffold is out of date".
metadata:
  author: taskless
  version: 0.1.0
  commandName: taskless:update-engine
compatibility: Designed for Agents implementing the Agent Skills specification.
---

# Taskless Update Engine

When this skill is invoked, run the update-engine CLI command to request a scaffold upgrade PR from the Taskless backend.

## Instructions

1. **Detect the package manager.** Check for `pnpm-lock.yaml` in the project root. If present, use `pnpm dlx`; otherwise, use `npx`.

2. **Run the update-engine command.** Execute:

   ```
   pnpm dlx @taskless/cli@latest update-engine --json
   ```

   (or `npx @taskless/cli@latest update-engine --json` if not using pnpm)

3. **Parse and report the output.** The command outputs JSON to stdout:
   - `{ "status": "current" }` — Tell the user their project is already up to date.
   - `{ "status": "open", "prUrl": "<url>" }` — Show the PR URL and suggest the user review and merge it.
   - `{ "status": "exists", "requestId": "<id>", "prUrl": "<url>" }` — Show the existing PR URL and suggest the user review and merge it.
   - `{ "status": "merged", "prUrl": "<url>" }` — Tell the user the upgrade was merged and they should pull their branch.
   - `{ "status": "closed", "prUrl": "<url>" }` — Tell the user the PR was closed and suggest re-running the command.

4. **Handle errors.** If the CLI exits with a non-zero code:
   - **Authentication required**: Suggest running `taskless auth login` first.
   - **Missing config**: Suggest running `taskless init` to set up the project.
   - **API errors**: Report the error message and suggest trying again.
