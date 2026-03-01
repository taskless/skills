## 1. CLI Dependencies and Build Config

- [x] 1.1 Add `citty` as a runtime dependency in `packages/cli/package.json`
- [x] 1.2 Add Vite `define` to `packages/cli/vite.config.ts` that replaces `__VERSION__` with the version from package.json
- [x] 1.3 Add a `declare const __VERSION__: string` ambient declaration for TypeScript

## 2. CLI Subcommand Structure

- [x] 2.1 Create `packages/cli/src/commands/info.ts` with a citty command that outputs `{"version":"<version>"}` to stdout
- [x] 2.2 Replace `packages/cli/src/index.ts` stub with a citty main command that registers `info` as a subcommand and shows help by default

## 3. Info Skill Rewrite

- [x] 3.1 Rewrite `plugins/taskless/skills/info/SKILL.md` to detect package manager via lock file, invoke CLI via dlx/npx, parse JSON, and report version

## 4. Tests

- [x] 4.1 Update `packages/cli/test/cli.test.ts` to test `taskless info` JSON output and `taskless` (no args) help output
- [x] 4.2 Run `pnpm build && pnpm test` from root and verify all checks pass
