## 1. Detect command (cli-detect)

- [x] 1.1 Add a `detect` output schema under `packages/cli/src/schemas/` (linters, languages/frameworks, existing rule styles)
- [x] 1.2 Implement `packages/cli/src/commands/detect.ts`: deterministic, offline scan of linter configs, languages/frameworks, and the repo's own rule styles — no LLM, no network, no auth
- [x] 1.3 Register `detect` in `packages/cli/src/index.ts` subCommands with `--json` and `--dir`/`-d`
- [x] 1.4 Emit `cli_detect` telemetry consistent with other commands
- [x] 1.5 Add unit tests covering: eslint/ruff/rubocop/biome/stylelint config detection, language/framework inference, repo-rule-style surfacing, and JSON-shape validation against the schema
- [x] 1.6 Add a test asserting `detect` produces no packaged-rule-catalog claims and runs without network/auth

## 2. Routing recipes (cli-rule-routing)

- [x] 2.1 Author `packages/cli/src/help/route.txt`: run `detect`; require the agent to WRITE its rationale first (detect signals, existing-linter coverage, ast-grep expressibility, local-solvability confidence) and name a destination only as a conclusion of that rationale; commit to the believed-correct path on REASONABLE confidence (existing/static/remote), route remote directly when not reasonably confident; when multiple paths fit, ask the user and explain trade-offs (note `remote` consumes a generation + needs login); never use a deliberate fail-first probe to select `remote`
- [x] 2.1a In `route.txt`, specify the try-verify-escalate FALLBACK: when a believed-local `static` path fails verification, inform the user the local rule couldn't capture the cases and PROMPT-AND-CONFIRM before calling the service — never silently fall through to `remote`
- [x] 2.2 Author `packages/cli/src/help/existing.txt`: author in the detected linter's dialect; repo-first knowledge sourcing then WebFetch; explicit author-only (user's toolchain runs it; `taskless check` does not run the external linter)
- [x] 2.3 Author `packages/cli/src/help/static.txt`: local ast-grep authoring with verification against success/failure cases; canonical on-disk shape and paths (`.taskless/rules/<id>.yml` + rule-tests, so `rule verify <id>` can read it); on verification failure into the escalation fallback, guarantee cleanup of the abandoned candidate rule + test files (mirrors the `rule create` cleanup intent); hand back to the `route` prompt-and-confirm fallback rather than escalating directly
- [x] 2.4 Author `packages/cli/src/help/remote.txt`: collect inputs, require auth, invoke the existing `rule create` backend; service decides static vs runtime; never decide that locally
- [x] 2.5 Ensure all four recipes follow the embedded help-text format (header, sprintf escaping) and reference `detect`/`route` consistently

## 3. Help registration + telemetry (cli-help)

- [x] 3.1 Confirm the four `.txt` recipes are picked up by the `import.meta.glob` embedding and resolve via `taskless help <topic>`
- [x] 3.2 Ensure `route`, `existing`, `static`, `remote` appear in the `taskless help` (no-arg) topic index
- [x] 3.3 Verify `help_<topic>` intent telemetry fires for each routing topic
- [x] 3.4 Add tests for topic resolution, index listing, and telemetry capture

## 4. Skill routing posture (skill-taskless)

- [ ] 4.1 Update `skills/taskless/SKILL.md` `description`: replace the named-tool suppression clause so naming a linter engages routing via `taskless help route`; tighten (reword shorter) rather than append trigger text
- [ ] 4.1a Measure the resulting `description` length and assert it is ≤ 1024 chars (Agent Skills ceiling); treat overflow as a blocking failure and trim trigger wording until it fits
- [ ] 4.2 Update the skill body to route authoring requests through `taskless help route` (not `rule create` directly); remove the "quiet suggestion" suppression path; keep the skill a thin router with no linter knowledge
- [ ] 4.3 Bump the skill `metadata.version` per the file conventions
- [ ] 4.4 Verify the skill change against the updated `skill-taskless` scenarios (routing on named tool, no suppression wording, local-first before login)

## 5. Validation + quality gate

- [ ] 5.1 Run `pnpm openspec validate local-rule-routing` and resolve any issues
- [ ] 5.2 Add/curate the honesty eval fixtures (labeled request → expected route) and assert the `route` heuristic against both failure directions: under-confident (escalating a locally-solvable request to login) and over-confident (claiming local for a request that needs the service). Use the fixtures to calibrate the "confident enough for local" threshold
- [ ] 5.3 Run `pnpm typecheck` and `pnpm lint`; fix all failures
- [ ] 5.4 Manual smoke: `taskless detect --json`, then `taskless help route`/`existing`/`static`/`remote` resolve and read coherently end-to-end
