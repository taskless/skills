## 1. Codegen: ast-grep Schema

- [x] 1.1 Create codegen script at `packages/cli/scripts/fetch-ast-grep-schema.ts` that reads the `@ast-grep/cli` version from `packages/cli/package.json`, strips the semver range prefix, fetches `rule.json` from GitHub, adds a `$comment` field with timestamp/version/source, and writes to `packages/cli/src/generated/ast-grep-rule-schema.json`
- [x] 1.2 Add a `generate:ast-grep-schema` script to `packages/cli/package.json` that runs the fetch script via `tsx`
- [x] 1.3 Run the codegen script and commit the generated `ast-grep-rule-schema.json`

## 2. Migration-based `.taskless/` Bootstrap

- [x] 2.1 Create `filesystem/directory.ts` (public API: `ensureTasklessDirectory`), `filesystem/migrate.ts` (migration runner with numeric sorting and `Number.isFinite` version parsing), and `filesystem/types.ts` (Migration, Migrations types)
- [x] 2.2 Implement migration `"1"` in `filesystem/migrations/0001-init.ts`: write `README.md` (always overwrite), call `addToGitignore(cwd, [...])`, create `rules/` and `rule-tests/` subdirectories
- [x] 2.3 Integrate `ensureTasklessDirectory()` calls into `writeRuleFile()`, `writeRuleTestFile()`, and `generateSgConfig()`
- [x] 2.4 Add tests for migrations: first-run creates all files and sets version, subsequent calls are no-ops, outdated version runs only new migrations, idempotent re-runs succeed, v0 production format (`"version": "2026-03-02"`) treated as version 0

## 2b. Filesystem Refactoring

- [x] 2b.1 Move `sgconfig.ts` and `gitignore.ts` from `rules/` to `filesystem/` — these are filesystem concerns not rule concerns
- [x] 2b.2 Refactor `ensureTasklessGitignore(cwd)` to generic `addToGitignore(cwd, globs)` — migrations decide what entries to add
- [x] 2b.3 Separate `ensureTasklessDirectory` (in `directory.ts`) from migration logic (in `migrate.ts`) to avoid circular references
- [x] 2b.4 Fix migration runner: use max migration key (not array length) for version, sort migrations numerically via `toSorted()`, handle non-numeric versions via `Number.isFinite()`

## 2c. CLI Directory Restructure

- [x] 2c.1 Reorganize `actions/` into domain directories: `auth/`, `api/`, `rules/`, `install/`, `util/`, `filesystem/`
- [x] 2c.2 Update all imports across commands, actions, and tests

## 2d. Zod 4 Upgrade

- [x] 2d.1 Upgrade Zod 3 → 4, use native `z.fromJSONSchema()` for ast-grep schema and `z.toJSONSchema()` for `--schema` output
- [x] 2d.2 Remove `zod-to-json-schema` dependency
- [x] 2d.3 Fix `check` schema: replace `.nullish().transform()` with `.nullable().optional()` for Zod 4 compat

## 3. `rules verify` Command

- [x] 3.1 Create ast-grep Zod schema via `z.fromJSONSchema(astGrepSchema)` in `schemas/ast-grep-rule.ts`, plus `findRegexWithoutKind()` recursive checker
- [x] 3.2 Create Zod schemas for verify output at `schemas/rules-verify.ts` — schema mode and verify mode output types
- [x] 3.3 Curate annotated examples in `rules/verify-examples.ts`: simple pattern match, regex-with-kind, composite rule with `any`/`all`
- [x] 3.4 Implement Layer 1 (Zod schema validation): parse rule YAML, validate against ast-grep Zod schema, collect errors with field paths
- [x] 3.5 Implement Layer 2 (Taskless requirements): check required fields, regex-requires-kind, test file existence
- [x] 3.6 Implement Layer 3 (test execution): generate sgconfig, run `sg test` using `findSgBinary()`, parse output for pass/fail counts
- [x] 3.7 Wire up `verify` subcommand in `commands/rules.ts` with `--schema` mode and verify mode, supporting `--json` and `-d` flags
- [x] 3.8 Add help text at `help/rules-verify.txt`
- [x] 3.9 Add tests for verify: valid rule passes all layers, invalid rule reports schema errors, missing test file reported, `--schema` output contains expected keys, nonexistent rule errors, CLI integration test

## 4. Skill Routing (Modified Skills)

- [x] 4.1 Modify `skills/taskless-create-rule/SKILL.md` to add auth-check routing: run `taskless info --json` first, if `loggedIn` is true proceed with existing API flow, if false delegate to `taskless-create-rule-anonymous`
- [x] 4.2 Modify `skills/taskless-improve-rule/SKILL.md` to add auth-check routing: run `taskless info --json` first, if `loggedIn` is true proceed with existing API flow, if false delegate to `taskless-improve-rule-anonymous`

## 5. Anonymous Skills

- [x] 5.1 Create `skills/taskless-create-rule-anonymous/SKILL.md` with instructions for: running `taskless rules verify --schema --json` to learn syntax, gathering user input, deriving rule YAML, writing rule + test files, running `taskless rules verify <id> --json` in a fix loop, reporting results. No metadata sidecar. No `commandName` in metadata
- [x] 5.2 Create `skills/taskless-improve-rule-anonymous/SKILL.md` with instructions for: reading existing rule + tests, running `taskless rules verify --schema --json`, gathering improvement guidance, modifying rule, writing updated files, running verify loop. Support iterate/replace/expand approaches. No `commandName` in metadata
- [x] 5.3 Verify anonymous skills have correct frontmatter: `name`, `description`, `metadata.author: taskless`, no `commandName`

## 6. Init Integration

- [x] 6.1 Verify that the existing `import.meta.glob` pattern in `install/install.ts` automatically picks up the new anonymous skill directories
- [x] 6.2 Confirm that anonymous skills without `commandName` metadata are skipped by `scripts/generate-commands.ts`
- [x] 6.3 Run `taskless init` in a test directory and verify 9 skills installed (including anonymous), 6 commands (excluding anonymous)

## 7. Validation and Quality

- [x] 7.1 Run `pnpm typecheck` across all packages and fix any type errors
- [x] 7.2 Run `pnpm lint` and fix any linting issues
- [x] 7.3 Run full test suite — 88 tests passing across 11 test files
- [ ] 7.4 Manually test end-to-end: create a rule via anonymous flow, verify it passes `rules verify`, run `taskless check` against test code
