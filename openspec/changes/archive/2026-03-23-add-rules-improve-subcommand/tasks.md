## 1. API Layer

- [x] 1.1 Add iterate types to `rule-api.ts`: `RuleImproveRequest` (from-file schema), `iterateRule()` function wrapping `POST /cli/api/rule/{ruleId}/iterate`
- [x] 1.2 Update `RuleCreateRequest` to use `successCases?: string[]` and `failureCases?: string[]` (replacing singular string fields)

## 2. CLI Subcommand

- [x] 2.1 Add `improveCommand` to `packages/cli/src/commands/rules.ts` with `--from`, `--dir`, `--json` args
- [x] 2.2 Implement improve flow: read JSON file → validate `ruleId`/`guidance` → read project config → get token → call `iterateRule()` → poll with `pollRuleStatus()` → write rule/test files
- [x] 2.3 Register `improve` in `rulesCommand.subCommands`
- [x] 2.4 Update `submitRule` call in create command to use `successCases`/`failureCases` array fields

## 3. Help Files

- [x] 3.1 Create `packages/cli/src/help/rules-improve.txt` with usage, options, and JSON field documentation
- [x] 3.2 Update `packages/cli/src/help/rules.txt` to list `improve` alongside `create` and `delete`
- [x] 3.3 Update `packages/cli/src/help/rules-create.txt` to document `successCases`/`failureCases` array fields

## 4. Skill

- [x] 4.1 Create `skills/taskless-improve-rule/SKILL.md` with frontmatter (`name: taskless-improve-rule`, `commandName: tskl:improve`)
- [x] 4.2 Write skill instructions with decision tree: inventory rules → gather feedback → choose approach (iterate/replace/expand) → execute → suggest testing
- [x] 4.3 Update `skills/taskless-create-rule/SKILL.md` to document `successCases`/`failureCases` as arrays instead of concatenated strings

## 5. Verification

- [x] 5.1 Run `pnpm typecheck` — all types resolve
- [x] 5.2 Run `pnpm lint` — no violations
- [x] 5.3 Run `pnpm build` — CLI compiles with new subcommand and help file
- [x] 5.4 Verify `pnpm cli help rules` lists `improve`
- [x] 5.5 Verify `pnpm cli help rules improve` shows correct help text
