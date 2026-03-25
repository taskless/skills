---
name: taskless-create-rule
description: Creates a new Taskless rule from a description. Use when the user wants to create a rule, add a lint rule, define a code pattern to detect, or generate an ast-grep rule. Trigger on "create a rule", "add a taskless rule", "new rule for", or "detect this pattern".
metadata:
  author: taskless
  version: 0.3.0
  commandName: tskl:rule
compatibility: Designed for Agents implementing the Agent Skills specification.
---

# Taskless Rule Create

When this skill is invoked, work with the user to build a comprehensive rule request, then write a JSON file and run the CLI to generate a rule.

Your goal is to produce the best possible rule by enriching the user's initial description with concrete examples, edge cases, and exclusions — not just pass their request through verbatim.

## Instructions

1. **Read current command documentation.** Run `pnpm dlx @taskless/cli@latest help rules create` and read the output. Use this to understand the command's `--from` JSON fields, options, and examples.

2. **Gather the rule description.** Ask the user what pattern they want to detect. This becomes the `prompt` field (required).

3. **Enrich the request.** After receiving the initial description, actively work with the user to strengthen the rule. Do all of the following:

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

   e. **Infer the language.** Detect the language from the codebase or the user's examples. Confirm your assumption with the user.

4. **Confirm the enriched request.** Before submitting, present a summary of what you'll send to the API:
   - The full prompt (including any exclusion notes)
   - The language
   - The success case(s)
   - The failure case(s)

   Ask the user to confirm or adjust before proceeding.

5. **Write the JSON payload to a file.** Build a JSON object with the gathered fields. Write the JSON to `.taskless/.tmp-rule-request.json`.

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

6. **Invoke the CLI.** Run `pnpm dlx @taskless/cli@latest rules create --from .taskless/.tmp-rule-request.json --json`. The command may take 30-60 seconds as it polls the API.

7. **Clean up.** After the command completes (success or failure), delete the `.taskless/.tmp-rule-request.json` file.

8. **Report the results.** When the CLI completes, show the generated file paths and suggest running `taskless-check` to test the new rule.

9. **Handle errors.** If the CLI fails:
   - **Authentication required**: Suggest the `taskless-login` skill.
   - **Missing config**: Suggest running `pnpm dlx @taskless/cli@latest init` to set up the project.
   - **Stale scaffold version**: Suggest the `taskless-update-engine` skill.
   - **API errors**: Report the error message and suggest trying again.
