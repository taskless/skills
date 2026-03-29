## 1. Dependencies

- [x] 1.1 Add `zod` and `zod-to-json-schema` as dependencies in `packages/cli/package.json`
- [x] 1.2 Run `pnpm install` to update lockfile

## 2. Zod Schema Definitions

- [x] 2.1 Create `packages/cli/src/schemas/rules-create.ts` with `inputSchema`, `outputSchema`, and `errorSchema`
- [x] 2.2 Create `packages/cli/src/schemas/rules-improve.ts` with `inputSchema`, `outputSchema`, and `errorSchema`
- [x] 2.3 Create `packages/cli/src/schemas/check.ts` with `outputSchema` and `errorSchema` (including `CheckResult` as a Zod schema)
- [x] 2.4 Create `packages/cli/src/schemas/update-engine.ts` with `outputSchema` and `errorSchema`

## 3. Schema Output Helper

- [x] 3.1 Create `packages/cli/src/actions/schema-output.ts` with a helper function that takes optional input, output, and error Zod schemas, converts them via `zod-to-json-schema`, and prints the three labeled blocks to stdout

## 4. Global --schema Flag

- [x] 4.1 Add `--schema` boolean arg to the main command definition in `packages/cli/src/index.ts`

## 5. Wire --schema Into Commands

- [x] 5.1 Add `--schema` short-circuit to `rules create` command — check `args.schema` at top of `run()`, print schemas, exit 0
- [x] 5.2 Add `--schema` short-circuit to `rules improve` command
- [x] 5.3 Add `--schema` short-circuit to `check` command
- [x] 5.4 Add `--schema` short-circuit to `update-engine` command

## 6. Replace Manual Input Validation With Zod

- [x] 6.1 In `rules create` command, replace manual `typeof request.prompt` checks with `inputSchema.parse(request)`
- [x] 6.2 In `rules improve` command, replace manual `typeof request.ruleId` / `typeof request.guidance` checks with `inputSchema.parse(request)`
- [x] 6.3 Remove `RuleCreateRequest` and `RuleImproveRequest` interfaces from `rule-api.ts` — infer types from Zod schemas instead

## 7. Validate --json Output With Zod

- [x] 7.1 In `rules create`, wrap the success `JSON.stringify` call with `outputSchema.parse()`
- [x] 7.2 In `rules improve`, wrap the success `JSON.stringify` call with `outputSchema.parse()`
- [x] 7.3 In `check` command, wrap `formatJson` output through `outputSchema.parse()` or `errorSchema.parse()` as appropriate
- [x] 7.4 In `update-engine`, wrap each `JSON.stringify` call with the appropriate schema `.parse()`

## 8. Verification

- [x] 8.1 Run `pnpm typecheck` and fix any type errors
- [x] 8.2 Run `pnpm lint` and fix any lint issues
- [x] 8.3 Run `pnpm build` in `packages/cli` and verify the build succeeds
