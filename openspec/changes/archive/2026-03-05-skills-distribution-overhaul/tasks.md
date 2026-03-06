## 1. Repo Structure

- [x] 1.1 Create `skills/taskless-info/SKILL.md` by moving and renaming from `plugins/taskless/skills/info/SKILL.md` — update frontmatter `name` to `taskless-info`
- [x] 1.2 Delete `plugins/` directory
- [x] 1.3 Create `commands/taskless/` directory
- [x] 1.4 Create `.claude-plugin/` directory

## 2. New Skills

- [x] 2.1 Create `skills/taskless-auth-login/SKILL.md` — informational skill explaining `taskless auth login` command and device flow
- [x] 2.2 Create `skills/taskless-auth-logout/SKILL.md` — informational skill explaining `taskless auth logout` command
- [x] 2.3 Create `skills/taskless-rules-create/SKILL.md` — conversational skill that gathers prompt/language/examples, constructs JSON, pipes to CLI
- [x] 2.4 Create `skills/taskless-rules-delete/SKILL.md` — conversational skill that lists rules, confirms target, runs CLI delete

## 3. Build Scripts

- [x] 3.1 Add `tsx` as a root devDependency
- [x] 3.2 Create `scripts/generate-commands.ts` — reads `skills/taskless-*/SKILL.md`, strips `taskless-` prefix, writes `commands/taskless/*.md` with command frontmatter (name: "Taskless: Title Case", category: "Taskless", tags: ["taskless"])
- [x] 3.3 Create `scripts/sync-skill-versions.ts` — reads `packages/cli/package.json` version, updates `metadata.version` in all `skills/*/SKILL.md` files, idempotent
- [x] 3.4 Run `generate-commands` to populate `commands/taskless/` with generated command files
- [x] 3.5 Run `sync-skill-versions` to set all `metadata.version` to current CLI version

## 4. Root Package Scripts

- [x] 4.1 Add `"version": "changeset version && tsx scripts/sync-skill-versions.ts"` to root `package.json` scripts
- [x] 4.2 Add `"generate-commands": "tsx scripts/generate-commands.ts"` to root `package.json` scripts

## 5. Marketplace Manifest

- [x] 5.1 Create `.claude-plugin/marketplace.json` with `name: "taskless"`, `owner`, and single plugin entry with `source: "."`
- [x] 5.2 Create `.claude-plugin/plugin.json` with `name: "taskless"`, `description`, `version`, `skills`, and `commands` paths

## 6. CLI Refactor — Vite Config

- [x] 6.1 Update `import.meta.glob` in `install.ts` to point to `../../skills/**/SKILL.md` (from `../../../../plugins/taskless/skills/**/SKILL.md`)
- [x] 6.2 Add second `import.meta.glob` in `install.ts` for `../../commands/taskless/**/*.md` (raw, eager)
- [x] 6.3 Add build-time version assertion in `vite.config.ts` — a plugin that reads embedded skills and asserts `metadata.version` matches CLI version, failing the build on mismatch

## 7. CLI Refactor — install.ts

- [x] 7.1 Remove `buildNamespacedSkillContent` function and prefix logic — skills are installed verbatim
- [x] 7.2 Remove `deriveCommand` and `titleCase` functions — commands come from embedded source
- [x] 7.3 Remove `writeAgentsMd`, `buildAgentsMdRegion`, `parseAgentsMdVersion`, and `AGENTS_BEGIN_PATTERN`/`AGENTS_END_MARKER` constants
- [x] 7.4 Remove AGENTS.md staleness check from `checkStaleness()`
- [x] 7.5 Add embedded commands support — new `getEmbeddedCommands()` function and glob import
- [x] 7.6 Update `installForTool` to install skills verbatim (no prefix) and place commands from embedded source (Claude Code only)
- [x] 7.7 Update `TOOLS` registry — remove `prefix` field from Claude Code entry

## 8. CLI Refactor — init.ts

- [x] 8.1 Remove `writeAgentsMd` import and the no-tools AGENTS.md fallback
- [x] 8.2 Add no-tools message suggesting marketplace or Vercel skills CLI
- [x] 8.3 Add command installation output (report placed commands alongside skills)

## 9. CLI Cleanup

- [x] 9.1 Remove `release` script from `packages/cli/package.json`

## 10. Verification

- [x] 10.1 Run `pnpm typecheck` and fix any type errors
- [x] 10.2 Run `pnpm lint` and fix any lint errors
- [x] 10.3 Run `pnpm build` and verify it succeeds with version assertion
- [x] 10.4 Verify all 5 skills exist under `skills/` with correct frontmatter
- [x] 10.5 Verify all 5 commands exist under `commands/taskless/` with correct frontmatter
- [x] 10.6 Verify `.claude-plugin/marketplace.json` and `plugin.json` are valid JSON
