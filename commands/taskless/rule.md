---
name: "Taskless: Rule"
description: Creates a new Taskless rule from a description. Use when the user wants to create a rule, add a lint rule, define a code pattern to detect, or generate an ast-grep rule. Trigger on "create a rule", "add a taskless rule", "new rule for", or "detect this pattern".
category: Taskless
tags:
  - taskless
metadata:
  author: taskless
  version: 0.0.7
  commandName: taskless:rule
---

# Taskless Rule Create

When this skill is invoked, gather the necessary information from the user, write a JSON file, and run the CLI to generate a rule.

## Instructions

1. **Read current command documentation.** Run `pnpm dlx @taskless/cli@latest help rules create` and read the output. Use this to understand the command's `--from` JSON fields, options, and examples.

2. **Gather the rule description.** Ask the user what pattern they want to detect. This becomes the `prompt` field (required).

3. **Optionally gather additional context.** If the user's request is vague or could benefit from more detail, ask about additional fields described in the help output (language, success/failure cases).

   You MAY analyze the codebase to infer the language or find relevant code examples. If you do, confirm your assumptions with the user before proceeding.

4. **Write the JSON payload to a file.** Build a JSON object with the gathered fields. Only include optional fields if they were gathered or inferred. Write the JSON to `.taskless/.tmp-rule-request.json`.

5. **Invoke the CLI.** Run `pnpm dlx @taskless/cli@latest rules create --from .taskless/.tmp-rule-request.json --json`. The command may take 30-60 seconds as it polls the API.

6. **Clean up.** After the command completes (success or failure), delete the `.taskless/.tmp-rule-request.json` file.

7. **Report the results.** When the CLI completes, show the generated file paths and suggest running `taskless check` to test the new rule.

8. **Handle errors.** If the CLI fails:
   - **Authentication required**: Suggest running `taskless auth login` first.
   - **Missing config**: Suggest running `taskless init` to set up the project.
   - **Stale scaffold version**: Suggest running `taskless update-engine` to update the `.taskless/` engine directory.
   - **API errors**: Report the error message and suggest trying again.
