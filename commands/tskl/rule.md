---
name: "Taskless: Rule"
description: Creates a new Taskless rule from a description. Use when the user wants to create a rule, add a lint rule, define a code pattern to detect, or generate an ast-grep rule. Trigger on "create a rule", "add a taskless rule", "new rule for", or "detect this pattern".
category: Taskless
tags:
  - taskless
metadata:
  author: taskless
  version: 0.5.1
  commandName: tskl:rule
---

# Taskless Rule Create

When this skill is invoked, work with the user to build a comprehensive rule request and generate a rule.

Your goal is to produce the best possible rule by enriching the user's initial description with concrete examples, edge cases, and exclusions — not just pass their request through verbatim.

## Instructions

**Package manager:** All commands below use `npx` as the default. If the project uses a different package manager (check for `pnpm-lock.yaml`, `yarn.lock`, or `bun.lockb`), prefer its equivalent: `pnpm dlx`, `yarn dlx`, or `bunx`.

1. **Check authentication status.** Run `npx @taskless/cli@latest info --json` and parse the JSON output. Check the `loggedIn` field:
   - If `loggedIn` is `true`: continue with step 2 below (API-backed flow).
   - If `loggedIn` is `false`: **stop here** and invoke the `taskless-create-rule-anonymous` skill instead. Pass along any context the user has already provided about the rule they want to create.

2. **Read current command documentation.** Run `npx @taskless/cli@latest help rules create` and read the output. Use this to understand the command's `--from` JSON fields, options, and examples.

3. **Gather the rule description.** Even if the user provided a description with their command, you MUST ask clarifying questions before proceeding. Do NOT skip to rule generation. Ask what specific code pattern should be flagged, with concrete examples. This becomes the `prompt` field (required).

4. **Check for existing similar rules.** Once you have the user's description, scan `.taskless/rules/` for existing rule files. Read each rule's `message`, `note`, and `rule` fields to understand what patterns are already covered. If any existing rule appears to overlap with the user's request:
   - Show the user the similar rule(s) and explain the overlap.
   - Ask: "It looks like you already have a rule that covers something similar. Would you like to **improve the existing rule** instead of creating a new one?"
   - If the user wants to improve, stop this skill and invoke the `taskless-improve-rule` skill (command name `tskl:improve`) with context about which rule to iterate on.
   - If the user confirms they want a separate new rule, proceed with creation.

5. **Enrich the request.** After receiving the initial description, actively work with the user to strengthen the rule. Do all of the following:

   a. **Search the codebase for real examples.** Proactively scan the codebase for instances of the pattern they want to detect. Show them what you found and ask:
   - "I found N instances of this pattern in your codebase. Should I include some as examples in the rule request?"
   - If you find variations of the pattern, highlight them as potential edge cases.

   b. **Ask for success and failure cases.** Even if the user provided examples, ask if there are other cases to consider:
   - "Are there edge cases or variations of this pattern that should also be caught?"
   - "Can you show me an example of the _correct_ way to write this code?"
   - Use any examples the user provided in their description as a starting point, but look for more.

   c. **Collect default ignores from the project.** Before asking the user about exclusions, check the project for existing ignore patterns that inform what files the rule should skip. Look at:
   - `.gitignore` — files already excluded from version control (e.g., `node_modules/`, `dist/`, build artifacts)
   - Linter configs (e.g., `eslint.config.js`, `.eslintignore`) — files or directories already excluded from linting
   - `tsconfig.json` `exclude` field — files excluded from type checking
   - Any other relevant config that signals "these files are not authored source code"

   Use these to build a baseline set of ignores. Present them to the user as defaults that will be included in the rule prompt.

   d. **Ask about additional exclusions.** Beyond the defaults, ask the user if there are files, directories, or contexts where the pattern is acceptable:
   - "Are there any files or directories where this pattern should be allowed? (e.g., `.d.ts` files, test files, generated code)"
   - Incorporate both the default ignores and user-specified exclusions into the `prompt` field so the rule generator understands the boundaries.

   e. **Infer the language.** Detect the primary language from the codebase or the user's examples. Confirm your assumption with the user. Include the target language in the `prompt` field (e.g., "Detect X in TypeScript files") so the rule generator knows what language to target.

6. **Confirm the enriched request.** Before submitting, present a summary of what you'll send to the API:
   - The full prompt (including language and any exclusion notes)
   - The success case(s)
   - The failure case(s)

   Ask the user to confirm or adjust before proceeding.

7. **Write the JSON payload to a file.** Build a JSON object with the gathered fields. Write the JSON to `.taskless/.tmp-rule-request.json`.

   **Multiple examples:** The `successCases` and `failureCases` fields are arrays of strings. Each example is a separate array element:

   ```json
   {
     "prompt": "...",
     "failureCases": [
       "/// <reference types=\"@cloudflare/workers-types\" />\nexport class MyWorker { ... }",
       "/// <reference types=\"vite/client\" />\nconst x = import.meta.env.FOO;"
     ],
     "successCases": [
       "import type { DurableObjectState } from 'cloudflare:workers';\nexport class MyWorker { ... }",
       "// .d.ts files are exempt — triple-slash is idiomatic there\n/// <reference types=\"@cloudflare/workers-types\" />"
     ]
   }
   ```

8. **Invoke the CLI.** Run `npx @taskless/cli@latest rules create --from .taskless/.tmp-rule-request.json --json`. The command may take 30-60 seconds as it polls the API.

9. **Clean up.** After the command completes (success or failure), delete the `.taskless/.tmp-rule-request.json` file.

10. **Report the results.** When the CLI completes, show the generated file paths and suggest running `taskless-check` to test the new rule. The CLI also writes sidecar metadata to `.taskless/rule-metadata/<rule-id>.yml` containing the `ticketId` used for future iterations. You can retrieve this with `npx @taskless/cli@latest rules meta <rule-id> --json`.

11. **Handle errors.** If the CLI fails:
    - **Authentication required**: Suggest the `taskless-login` skill.
    - **Missing organization info**: Suggest running `npx @taskless/cli@latest auth login` to re-authenticate.
    - **API errors**: Report the error message and suggest trying again.
