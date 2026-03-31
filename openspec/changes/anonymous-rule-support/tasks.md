## 1. Codegen: ast-grep Schema

- [x] 1.1 Create codegen script at `packages/cli/scripts/fetch-ast-grep-schema.ts` that reads the `@ast-grep/cli` version from `packages/cli/package.json`, strips the semver range prefix, fetches `rule.json` from `https://raw.githubusercontent.com/ast-grep/ast-grep/{VERSION}/schemas/rule.json`, adds a `$comment` field with timestamp/version/source, and writes to `packages/cli/src/generated/ast-grep-rule-schema.json`
- [x] 1.2 Add a `codegen:ast-grep-schema` script to `packages/cli/package.json` that runs the fetch script via `tsx`
- [x] 1.3 Run the codegen script and commit the generated `ast-grep-rule-schema.json`

## 2. Migration-based `.taskless/` Bootstrap

- [ ] 2.1 Create `packages/cli/src/actions/bootstrap.ts` with migration infrastructure: `type Migration = (dir: string) => Promise<undefined>`, migrations stored as `Record<string, Migration>`, `ensureTasklessDirectory(cwd)` that reads `taskless.json` version (default 0), runs pending migrations in order, and updates the version
- [ ] 2.2 Implement `001-init` migration: create `README.md` (with usage docs and file listing), call `ensureTasklessGitignore()`, create `rules/` and `rule-tests/` subdirectories. All operations idempotent (check before write)
- [ ] 2.3 Integrate `ensureTasklessDirectory()` calls into `writeRuleFile()`, `writeRuleTestFile()`, and `generateSgConfig()` in the existing action files
- [ ] 2.4 Add tests for migrations: first-run creates all files and sets version, subsequent calls are no-ops, outdated version runs only new migrations, idempotent re-runs succeed

## 3. `rules verify` Command

- [ ] 3.1 Create a Zod schema derived from the ast-grep JSON Schema for rule validation. Use `.passthrough()` for fields Taskless doesn't need to deeply validate. Layer Taskless-specific checks as `.refine()` calls (required fields, regex-requires-kind)
- [ ] 3.2 Create Zod schemas for verify output at `packages/cli/src/schemas/rules-verify.ts` — schema mode output (`astGrepSchema`, `tasklessRequirements`, `examples`) and verify mode output (`success`, `ruleId`, `schema`, `requirements`, `tests` layers)
- [ ] 3.3 Curate annotated examples for the `--schema` output: simple pattern match, regex-with-kind, and composite rule with `any`/`all`. Store as a constant in the verify command or a separate examples file
- [ ] 3.4 Implement Layer 1 (Zod schema validation): parse rule YAML, validate against the ast-grep Zod schema, collect errors with field paths
- [ ] 3.5 Implement Layer 2 (Taskless requirements): check required fields (`id`, `language`, `severity`, `message`, `rule`), check regex-requires-kind, check test file existence in `.taskless/rule-tests/`
- [ ] 3.6 Implement Layer 3 (test execution): generate sgconfig, run `sg test --config .taskless/sgconfig.yml` using `findSgBinary()`, parse output for pass/fail counts
- [ ] 3.7 Wire up the `verify` subcommand in `packages/cli/src/commands/rules.ts` with `--schema` mode (dumps combined schema payload) and verify mode (runs three layers), supporting `--json` and `-d` flags
- [ ] 3.8 Add help text at `packages/cli/src/help/rules-verify.txt`
- [ ] 3.9 Add tests for verify: valid rule passes all layers, invalid rule reports schema errors, missing test file reported, `--schema` output contains expected keys, nonexistent rule errors

## 4. Skill Routing (Modified Skills)

- [ ] 4.1 Modify `skills/taskless-create-rule/SKILL.md` to add auth-check routing: run `taskless info --json` first, if `loggedIn` is true proceed with existing API flow, if false delegate to `taskless-create-rule-anonymous`
- [ ] 4.2 Modify `skills/taskless-improve-rule/SKILL.md` to add auth-check routing: run `taskless info --json` first, if `loggedIn` is true proceed with existing API flow, if false delegate to `taskless-improve-rule-anonymous`

## 5. Anonymous Skills

- [ ] 5.1 Create `skills/taskless-create-rule-anonymous/SKILL.md` with instructions for: running `taskless rules verify --schema --json` to learn syntax, gathering user input, deriving rule YAML, writing rule + test files, running `taskless rules verify <id> --json` in a fix loop, reporting results. No metadata sidecar. Omit `commandName` from metadata (or set to `"-"`) so build scripts skip command generation
- [ ] 5.2 Create `skills/taskless-improve-rule-anonymous/SKILL.md` with instructions for: reading existing rule + tests, running `taskless rules verify --schema --json`, gathering improvement guidance, modifying rule, writing updated files, running verify loop. Support iterate/replace/expand approaches. Omit `commandName` from metadata
- [ ] 5.3 Verify anonymous skills have correct frontmatter: `name`, `description`, `metadata.author: taskless`, no `commandName` (or `"-"`)

## 6. Init Integration

- [ ] 6.1 Verify that the existing `import.meta.glob` pattern in `packages/cli/src/actions/install.ts` automatically picks up the new anonymous skill directories (the glob `../../../../skills/**/SKILL.md` should match without changes)
- [ ] 6.2 Confirm that anonymous skills without `commandName` metadata are skipped by `scripts/generate-commands.ts` (already gated at line 81)
- [ ] 6.3 Run `taskless init` in a test directory and verify anonymous skills are installed alongside existing skills without generating command files

## 7. Validation and Quality

- [ ] 7.1 Run `pnpm typecheck` across all packages and fix any type errors
- [ ] 7.2 Run `pnpm lint` and fix any linting issues
- [ ] 7.3 Run full test suite and fix any failures
- [ ] 7.4 Manually test end-to-end: create a rule via anonymous flow, verify it passes `rules verify`, run `taskless check` against test code
