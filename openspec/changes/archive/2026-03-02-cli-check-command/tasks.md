## 1. Dependencies and Global Flag

- [x] 1.1 Add `@ast-grep/cli` as a dependency in `packages/cli/package.json`
- [x] 1.2 Add the `--json` boolean argument to the main command definition in `src/index.ts`
- [x] 1.3 Register the `check` subcommand import in `src/index.ts`

## 2. Types and Result Model

- [x] 2.1 Define the `CheckResult` interface with fields: `source`, `ruleId`, `severity`, `message`, `note`, `file`, `range`, `matchedText`, `fix`
- [x] 2.2 Define the `AstGrepMatch` type matching the ast-grep JSONL output schema (`ruleId`, `severity`, `message`, `note`, `text`, `file`, `range`, `replacement`)
- [x] 2.3 Implement the mapping function from `AstGrepMatch` to `CheckResult`

## 3. Scanner Action

- [x] 3.1 Create `src/actions/scan.ts` with a function that spawns `sg scan --config .taskless/sgconfig.yml --json=stream` using `child_process.spawn` with `shell: true`
- [x] 3.2 Implement JSONL stream parsing — read stdout line by line, parse each line as JSON, map to `CheckResult`
- [x] 3.3 Handle scanner errors: binary not found, non-zero exit from spawn failures, stderr capture

## 4. Formatter Action

- [x] 4.1 Create `src/actions/format.ts` with a function that takes `CheckResult[]` and outputs human-readable text to stdout (file location, severity, rule ID, message, matched text, note, summary line)
- [x] 4.2 Implement JSON formatter that writes each `CheckResult` as a single-line JSON object to stdout (JSONL)

## 5. Check Command

- [x] 5.1 Create `src/commands/check.ts` with the `checkCommand` using `defineCommand` — accepts `dir` and `json` args
- [x] 5.2 Implement validation: check `.taskless/taskless.json` exists, error and exit 1 if missing
- [x] 5.3 Implement validation: check `.taskless/rules/` for `.yml` files, warn and exit 0 if empty
- [x] 5.4 Wire up: run scanner, format results, exit with code 0 (clean/warnings) or 1 (errors)

## 6. Build and Externals

- [x] 6.1 Verify Vite config handles the `@ast-grep/cli` dependency correctly (should be externalized since it's a binary package, not imported into source)

## 7. Tests

- [x] 7.1 Test: `taskless check` errors when `.taskless/taskless.json` is missing
- [x] 7.2 Test: `taskless check` warns and exits 0 when rules directory is empty
- [x] 7.3 Test: `taskless check` runs scanner and produces human output for rule matches
- [x] 7.4 Test: `taskless check --json` produces JSONL output for rule matches
- [x] 7.5 Test: `taskless check` exits 0 for warnings-only, exits 1 for errors
