## 1. Create workflow file

- [x] 1.1 Create `.github/workflows/` directory
- [x] 1.2 Create `ci.yml` with workflow name, triggers (`pull_request` targeting `main`, `push` to `main`), and a single job

## 2. Configure job environment

- [x] 2.1 Set up `pnpm/action-setup` to install pnpm matching the `packageManager` field
- [x] 2.2 Set up `actions/setup-node` with Node 22
- [x] 2.3 Add `pnpm install` step

## 3. Add validation steps

- [x] 3.1 Add `pnpm lint` step
- [x] 3.2 Add `pnpm typecheck` step
- [x] 3.3 Add `pnpm build` step
- [x] 3.4 Add `pnpm test` step

## 4. Verify

- [x] 4.1 Validate the workflow YAML is well-formed
- [x] 4.2 Confirm no publish or release steps are present
