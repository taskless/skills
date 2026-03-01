## 1. Install and Configure Turborepo

- [x] 1.1 Add `turbo` as a root devDependency and run `pnpm install`
- [x] 1.2 Create `turbo.json` with pipelines for `build`, `test`, and `typecheck`

## 2. Wire Up Root Scripts

- [x] 2.1 Add `build`, `test`, and `typecheck` scripts to root `package.json` that delegate to `turbo run`

## 3. Verify

- [x] 3.1 Run `pnpm build` from root and verify CLI builds
- [x] 3.2 Run `pnpm test` from root and verify CLI tests pass
- [x] 3.3 Run `pnpm typecheck` from root and verify CLI typechecks
- [x] 3.4 Run `pnpm build` a second time and verify cache hit
