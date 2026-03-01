## 1. Clean Up Root Package

- [x] 1.1 Rename package to `@taskless/skills` in `package.json`
- [x] 1.2 Remove all Twitchdrift dependencies (React, Cloudflare, Spotify, Kysely, Tailwind, motion, etc.) from `package.json`
- [x] 1.3 Move `vite`, `vite-tsconfig-paths` to kept devDependencies (needed by CLI workspace)
- [x] 1.4 Remove all Twitchdrift scripts (`codegen`, `dev`, `kysely`, `track`, `typegen`, `typecheck`) from `package.json`
- [x] 1.5 Set root scripts to `lint`, `lint:fix`, `prepare`
- [x] 1.6 Delete root `vite.config.ts`
- [x] 1.7 Simplify root `tsconfig.json` (remove `composite`, `declarationMap`, keep minimal)

## 2. Set Up Workspace

- [x] 2.1 Create `pnpm-workspace.yaml` declaring `packages/*`
- [x] 2.2 Run `pnpm install` to regenerate lock file with cleaned dependencies

## 3. Create Skills Plugin Structure

- [x] 3.1 Create `.claude-plugin/marketplace.json` registering the `taskless` plugin
- [x] 3.2 Create `plugins/taskless/.claude-plugin/plugin.json` plugin manifest
- [x] 3.3 Create `plugins/taskless/skills/info/SKILL.md` with YAML frontmatter and instructions for `/taskless:info`

## 4. Create CLI Package

- [x] 4.1 Create `packages/cli/package.json` (`@taskless/cli`, bin entry, build/typecheck scripts)
- [x] 4.2 Create `packages/cli/tsconfig.json` extending `../../tsconfig.base.json`
- [x] 4.3 Create `packages/cli/vite.config.ts` (library mode, single ESM output with shebang)
- [x] 4.4 Create `packages/cli/src/index.ts` (stub entry point that prints confirmation message)

## 5. Clean Up Tooling Config

- [x] 5.1 Clean `eslint.config.js` (remove `.react-router/`, Twitchdrift-specific ignores; add `plugins/` ignore for markdown)
- [x] 5.2 Rewrite `README.md` for the skills repo

## 6. CLI Test Harness

- [x] 6.1 Add vitest to CLI devDependencies and add test script
- [x] 6.2 Create CLI integration test (spawns built binary, checks stdout and shebang)
- [x] 6.3 Run tests and verify they pass

## 7. Verify

- [x] 7.1 Run `pnpm lint` and fix any issues
- [x] 7.2 Run `pnpm --filter @taskless/cli typecheck` and fix any issues
- [x] 7.3 Run `pnpm --filter @taskless/cli build` and verify output has shebang and is executable
