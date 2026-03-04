## 1. Rule Generation Network Interface and Stub

- [x] 1.1 Create `packages/cli/src/actions/rule-api.ts` with request/response types matching the real API: `RuleCreateRequest` (`prompt`, `language?`, `successCase?`, `failureCase?` — the stdin-provided fields), `RuleApiRequest` (the full POST body including `orgId`, `repositoryUrl`), `RuleRequestResponse` (`requestId`, `status`), `RuleRequestStatus` (union of `accepted`/`building`/`generated`/`failed` responses), and `GeneratedRule`/`RuleContent`/`RuleTestCase` types
- [x] 1.2 Define `RuleApiProvider` interface with methods `submitRequest(token, request: RuleApiRequest)` → `RuleRequestResponse` and `pollRequestStatus(token, requestId)` → `RuleRequestStatus`
- [x] 1.3 Implement `StubRuleApiProvider` that returns an error indicating rule generation is not yet available
- [x] 1.4 Export a default provider instance (same pattern as `deviceFlowProvider` in `device-flow.ts`)

## 2. Project Config Reading

- [x] 2.1 Add a new compatibility range in `packages/cli/src/capabilities.ts` for the rules-generation spec version that requires `orgId` and `repositoryUrl` in `taskless.json`
- [x] 2.2 Create `packages/cli/src/actions/project-config.ts` with `readProjectConfig(cwd)` that reads `.taskless/taskless.json` and returns typed config including `version`, `orgId?`, and `repositoryUrl?`
- [x] 2.3 Add `validateRulesConfig(config)` that checks the spec version is in the rules-compatible range and that `orgId` and `repositoryUrl` are present, returning a clear error if not

## 3. Rule File Writing

- [x] 3.1 Create `packages/cli/src/actions/rule-files.ts` with `writeRuleFile(cwd, rule)` that serializes `GeneratedRule.content` to YAML and writes to `.taskless/rules/{kebab-id}.yml`, creating the directory if needed
- [x] 3.2 Add `writeRuleTestFile(cwd, rule, timestamp)` that writes `{ id, valid, invalid }` as YAML to `.taskless/rule-tests/{kebab-id}-{timestamp}-test.yml`, creating the directory if needed
- [x] 3.3 Add `deleteRuleFiles(cwd, id)` that removes `.taskless/rules/{id}.yml` and any matching `.taskless/rule-tests/{id}-*-test.yml` files, returning whether the rule file existed

## 4. Rules Commands

- [x] 4.1 Create `packages/cli/src/commands/rules.ts` with `rulesCommand` as a citty subcommand group containing `create` and `delete`
- [x] 4.2 Implement `create` handler: read stdin as JSON, validate `prompt` is present, read project config for `orgId`/`repositoryUrl`/`version`, validate rules-compatible spec version, resolve auth token via `getToken()`, call provider to submit request, poll at 15s intervals showing status (`accepted`/`building`) to stderr, write rule and test files on `generated`, output summary (text or `--json`), handle API errors (400/403/404) with clear messages
- [x] 4.3 Implement `delete` handler: accept positional `id` argument, call `deleteRuleFiles()`, print confirmation or error if not found
- [x] 4.4 Register `rulesCommand` in `packages/cli/src/index.ts` alongside existing subcommands

## 5. Build and Validation

- [x] 5.1 Run `pnpm typecheck` and fix any type errors
- [x] 5.2 Run `pnpm lint` and fix any lint issues
- [x] 5.3 Run `pnpm build` and verify the CLI bundles correctly with new modules
