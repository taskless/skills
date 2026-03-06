---
name: taskless-rule-create
description: Creates a new Taskless rule from a description. Use when the user wants to create a rule, add a lint rule, define a code pattern to detect, or generate an ast-grep rule. Trigger on "create a rule", "add a taskless rule", "new rule for", or "detect this pattern".
metadata:
  author: taskless
  version: "0.0.5"
  commandName: "taskless:rule"
compatibility: Designed for Agents implementing the Agent Skills specification.
---

# Taskless Rule Create

When this skill is invoked, gather the necessary information from the user, construct a JSON payload, and pipe it to the CLI to generate a rule.

## Instructions

1. **Read current command documentation.** Run `pnpm dlx @taskless/cli@latest help rules create` and read the output. Use this to understand the command's stdin JSON fields, options, and examples.

2. **Gather the rule description.** Ask the user what pattern they want to detect. This becomes the `prompt` field (required).

3. **Optionally gather additional context.** If the user's request is vague or could benefit from more detail, ask about additional fields described in the help output (language, success/failure cases).

   You MAY analyze the codebase to infer the language or find relevant code examples. If you do, confirm your assumptions with the user before proceeding.

4. **Construct the JSON payload.** Build a JSON object with the gathered fields. Only include optional fields if they were gathered or inferred.

5. **Invoke the CLI.** Pipe the JSON to `pnpm dlx @taskless/cli@latest rules create --json`, using the examples from the help output as a guide. The command may take 30-60 seconds as it polls the API.

6. **Report the results.** When the CLI completes, show the generated file paths and suggest running `taskless check` to test the new rule.

7. **Handle errors.** If the CLI fails:
   - **Authentication required**: Suggest running `taskless auth login` first.
   - **Missing config**: Suggest running `taskless init` to set up the project.
   - **API errors**: Report the error message and suggest trying again.
