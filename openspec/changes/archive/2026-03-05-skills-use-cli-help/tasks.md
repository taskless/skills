## 1. Refactor skills to use CLI help

- [x] 1.1 Rewrite `skills/taskless-info/SKILL.md` to invoke `taskless help info` as the first step, remove hardcoded output format descriptions, and retain agent-specific workflow (JSON parsing, upgrade detection). Prefer `pnpm dlx` but don't make package manager detection a formal step
- [x] 1.2 Rewrite `skills/taskless-check/SKILL.md` to invoke `taskless help check` as the first step, use `--json` flag, remove hardcoded option lists and output format descriptions
- [x] 1.3 Rewrite `skills/taskless-login/SKILL.md` to invoke `taskless help auth login` as the first step, remove hardcoded usage/option docs, retain "do not run" agent guidance
- [x] 1.4 Rewrite `skills/taskless-logout/SKILL.md` to invoke `taskless help auth logout` as the first step, remove hardcoded usage/option docs, retain "do not run" agent guidance
- [x] 1.5 Rewrite `skills/taskless-rule-create/SKILL.md` to invoke `taskless help rules create` as the first step, use `--json` flag, remove hardcoded stdin JSON field descriptions, retain user input gathering workflow
- [x] 1.6 Rewrite `skills/taskless-rule-delete/SKILL.md` to invoke `taskless help rules delete` as the first step, remove hardcoded usage docs, retain rule listing/confirmation workflow

## 2. Regenerate commands from updated skills

- [x] 2.1 Run `pnpm generate-commands` to regenerate `commands/taskless/` from updated skills

## 3. Verification

- [x] 3.1 Run `pnpm typecheck` and `pnpm lint` to verify no errors
- [x] 3.2 Run `pnpm build` to verify skills are embedded correctly in the CLI bundle
