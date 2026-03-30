## 1. Remove update-engine command and scaffold version gating

- [ ] 1.1 Delete `packages/cli/src/commands/update-engine.ts` and remove its registration from the main CLI entry point
- [ ] 1.2 Delete `packages/cli/src/actions/update-api.ts` (backend API interaction for update-engine)
- [ ] 1.3 Remove `MIN_SCAFFOLD_VERSION`, `isScaffoldVersionSufficient()` from `packages/cli/src/capabilities.ts` (retain `isValidSpecVersion()`)
- [ ] 1.4 Delete the `update-engine` help file from `packages/cli/src/help/`
- [ ] 1.5 Remove or update the `taskless-update-engine` skill and its `tskl:update-engine` command
- [ ] 1.6 Verify typecheck and lint pass after removals

## 2. Add .taskless/.gitignore management

- [ ] 2.1 Create `packages/cli/src/actions/gitignore.ts` with an `ensureTasklessGitignore(cwd: string)` function that creates/updates `.taskless/.gitignore` with entries for `.env.local.json` and `sgconfig.yml`
- [ ] 2.2 Ensure the function is idempotent — appends missing entries without duplicating existing ones
- [ ] 2.3 Verify typecheck and lint pass

## 3. Make check command scaffold-independent

- [ ] 3.1 Create `packages/cli/src/actions/sgconfig.ts` with a `generateSgConfig(cwd: string)` function that writes ephemeral `sgconfig.yml` to `.taskless/` with `ruleDirs: ['rules']`
- [ ] 3.2 Call `ensureTasklessGitignore()` before writing `sgconfig.yml`
- [ ] 3.3 Rewrite `packages/cli/src/commands/check.ts` to remove all `taskless.json` validation — replace with direct check for `.taskless/rules/*.yml`
- [ ] 3.4 Update check to call `generateSgConfig()` before `runAstGrepScan()`
- [ ] 3.5 Handle the "no `.taskless/` directory" case: print "No rules configured" message and exit 0
- [ ] 3.6 Remove `readProjectConfig()` import and scaffold version checks from check command
- [ ] 3.7 Verify typecheck and lint pass

## 4. Add git remote inference

- [ ] 4.1 Create `packages/cli/src/actions/git-remote.ts` with a `resolveRepositoryUrl(cwd: string)` function that runs `git remote get-url origin` and canonicalizes to `https://github.com/{owner}/{repo}`
- [ ] 4.2 Handle SSH URLs (`git@github.com:owner/repo.git`), HTTPS URLs (`https://github.com/owner/repo.git`), and trailing `.git` removal
- [ ] 4.3 Return clear error messages for missing origin remote and non-GitHub URLs
- [ ] 4.4 Verify typecheck and lint pass

## 5. Add jose dependency and JWT decoding

- [ ] 5.1 Add `jose` as a dependency in `packages/cli/package.json`
- [ ] 5.2 Create `packages/cli/src/actions/jwt.ts` with a `decodeOrgId(token: string)` function that uses `jose`'s `decodeJwt()` to extract the `orgId` claim
- [ ] 5.3 Return `undefined` if the claim is missing (no throw — callers handle fallback)
- [ ] 5.4 Verify typecheck and lint pass

## 6. Add per-repo token storage

- [ ] 6.1 Update `packages/cli/src/actions/token.ts` `getToken()` to check `.taskless/.env.local.json` before the global auth file (after env var check)
- [ ] 6.2 Update `saveToken()` to write to both `.taskless/.env.local.json` (if in a git repo) and the global XDG location
- [ ] 6.3 Call `ensureTasklessGitignore()` before writing `.env.local.json`
- [ ] 6.4 Update `removeToken()` to delete both per-repo and global token files
- [ ] 6.5 Add a `warnIfTracked(cwd: string)` check that runs `git ls-files .taskless/.env.local.json` and prints a warning to stderr if the file is tracked
- [ ] 6.6 Verify typecheck and lint pass

## 7. Add identity resolution function

- [ ] 7.1 Create `packages/cli/src/actions/identity.ts` with `resolveIdentity(cwd: string): Promise<{ orgId: number, repositoryUrl: string }>`
- [ ] 7.2 Implement the resolution chain: get token → decode JWT for orgId (if missing, error with re-login prompt) → infer repositoryUrl from git remote
- [ ] 7.3 Verify typecheck and lint pass

## 8. Update rules commands to use identity resolution

- [ ] 8.1 Update `packages/cli/src/commands/rules.ts` `rules create` to use `resolveIdentity()` instead of `readProjectConfig()` + `validateRulesConfig()`
- [ ] 8.2 Update `rules improve` to use `resolveIdentity()` for `orgId` instead of project config
- [ ] 8.3 Stop sending `orgId` in the API request body — the backend reads it from the JWT (body `orgId` is deprecated but still accepted)
- [ ] 8.4 Remove the `readProjectConfig()` and `validateRulesConfig()` imports from rules commands
- [ ] 8.5 Verify typecheck and lint pass

## 9. Clean up obsolete code

- [ ] 9.1 Delete `packages/cli/src/actions/project-config.ts` entirely — no fallback needed
- [ ] 9.2 Remove scaffold version references from any remaining help text or error messages
- [ ] 9.3 Update `packages/cli/src/commands/check.ts` error messages to reference `taskless rules create` instead of `taskless init`
- [ ] 9.4 Verify typecheck and lint pass

## 10. Update skills and documentation

- [ ] 10.1 Remove the `taskless-update-engine` skill directory and its entry in skill distribution
- [ ] 10.2 Update `skill-auth-login` and `skill-auth-logout` to reflect per-repo token storage
- [ ] 10.3 Update `taskless-check` skill to remove scaffold prerequisite language
- [ ] 10.4 Update `taskless-create-rule` skill to remove `taskless.json` dependency language
- [ ] 10.5 Verify the CLI builds successfully (`pnpm build` in `packages/cli/`)
- [ ] 10.6 Run full typecheck and lint across all packages
