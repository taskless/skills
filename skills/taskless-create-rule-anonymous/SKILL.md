---
name: taskless-create-rule-anonymous
description: Creates a new Taskless rule locally without API access. Uses the agent to derive ast-grep rules from the schema and validates them with the verify feedback loop.
metadata:
  author: taskless
  version: 0.5.4
  commandName: "-"
compatibility: Designed for Agents implementing the Agent Skills specification.
---

# Taskless Rule Create (Anonymous)

This skill creates ast-grep rules locally without requiring Taskless authentication. You will derive the rule yourself using the ast-grep schema as a guide, then validate it using the verify command.

## Instructions

**Package manager:** All commands below use `npx` as the default. If the project uses a different package manager (check for `pnpm-lock.yaml`, `yarn.lock`, or `bun.lockb`), prefer its equivalent: `pnpm dlx`, `yarn dlx` (Yarn Berry/2+ only), or `bunx`.

1. **Learn the ast-grep rule format.** Run `npx @taskless/cli@latest rules verify --schema --json` and read the output. This gives you:
   - `astGrepSchema`: The official ast-grep rule JSON Schema — the full reference for what fields are valid.
   - `tasklessRequirements`: Fields Taskless requires beyond ast-grep defaults (`id`, `language`, `severity`, `message`, `rule`) and additional rules (e.g., `regex` requires `kind`).
   - `examples`: Annotated rule examples showing common patterns (simple match, regex with kind, composite rules).

   Study the examples carefully — they show how `pattern`, `kind`, `regex`, `any`, `all`, `has`, `inside`, and other combinators work.

2. **Gather the rule description.** Even if the user provided a description with their command, you MUST ask clarifying questions before proceeding. Do NOT skip to rule generation. Ask the user:
   - What specific code pattern should be flagged? Get concrete examples.
   - What language is it in?
   - Are there exceptions or edge cases where the pattern is acceptable?
   - Can they show examples of code that should and shouldn't trigger?

   Wait for the user's responses before moving to step 3.

3. **Check for existing similar rules.** Scan `.taskless/rules/` for existing rule files. If any overlap with the user's request, point it out and ask if they want to improve an existing rule instead (via `taskless-improve-rule-anonymous`).

4. **Search the codebase for real examples.** Proactively scan for instances of the pattern. Show the user what you found:
   - "I found N instances of this pattern. Should any of these be excluded?"
   - Highlight variations that might need separate handling.

5. **Derive the rule.** Using the ast-grep schema, examples, and the user's input, write the rule as a YAML file. The rule MUST include:
   - `id`: A kebab-case identifier (e.g., `no-eval`, `prefer-const`)
   - `language`: The target language (e.g., `typescript`, `javascript`, `python`)
   - `severity`: One of `error`, `warning`, `info`, or `hint`
   - `message`: A concise single-line explanation of why the rule fires
   - `rule`: The ast-grep rule object (using `pattern`, `kind`, `regex`, `any`, `all`, etc.)

   Optional but recommended:
   - `note`: Additional guidance or suggested fixes (supports markdown)
   - `fix`: Auto-fix pattern if applicable

   Write the rule to `.taskless/rules/<id>.yml`.

6. **Write test cases.** Create a test file at `.taskless/rule-tests/<id>-<YYYYMMDD>-test.yml` with:
   - `id`: Same as the rule ID
   - `valid`: An array of code snippets that should NOT trigger the rule
   - `invalid`: An array of code snippets that SHOULD trigger the rule

   Include at least 2 valid and 2 invalid cases. Use real patterns from the codebase where possible.

7. **Verify the rule.** Run `npx @taskless/cli@latest rules verify <id> --json` and check the result:
   - If `success` is `true`: the rule passes all checks. Report success to the user.
   - If `success` is `false`: read the error details from each layer (`schema`, `requirements`, `tests`) and fix the issues. Then re-run verify. Repeat until it passes or you've made 3 attempts.

   Common fixes:
   - Schema errors: Check field types and structure against the ast-grep schema.
   - Missing required fields: Add any fields listed in the Taskless requirements.
   - Regex without kind: Add a `kind` field alongside any `regex` field.
   - Test failures: Adjust the rule pattern or test cases so valid cases pass and invalid cases are caught.

8. **Report results.** Once verified, show the user:
   - The rule file path
   - The test file path
   - A summary of what the rule detects
   - Suggest running `taskless-check` to see the rule in action

## Important Notes

- Do NOT write files to `.taskless/rule-metadata/`. Anonymous rules have no metadata sidecar.
- Do NOT make any API calls to taskless.io.
- The verify feedback loop is your quality gate — always run it before reporting success.
