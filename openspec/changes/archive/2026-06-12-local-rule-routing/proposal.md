## Why

Authoring a rule today routes straight to `rule create`, which is login-gated and
runs generation off the developer's machine. There is no local front door that
asks "what kind of rule is this, and can I build it on-device first?" — so users
hit a login wall before Taskless has demonstrated it needs the service. At the
same time, the skill actively _suppresses_ itself when a user names a linter
(eslint, ruff, biome), stepping back from exactly the requests where Taskless
could help author the rule in that tool's own dialect. We want a local routing
layer that keeps authoring on-device whenever possible, engages other linters
instead of deferring, and suggests login only when it is not reasonably
confident a rule can be built locally — or when a confident local attempt has
failed and the user confirms spending a generation.

## What Changes

- **NEW `taskless detect --json`** — a deterministic, offline repo-signal scan:
  which linters are configured, languages present, and the styles of the repo's
  own existing rules. No LLM, no network. Feeds the routing recipe.
- **NEW routing recipe layer** under `help`, replacing the rule-type-agnostic
  `rule create` entry as the front door for "author a rule":
  - `route` — the lightweight **local classifier**. Biased to stay local;
    suggests login when it is not reasonably confident the rule is locally
    solvable, or when a confident local attempt fails and the user confirms.
  - `existing` — author a rule in a linter already detected in the repo, in that
    tool's dialect, sourced from the repo's own rules plus the agent's WebFetch.
  - `static` — author a local ast-grep rule on-device, verified against the
    user's success/failure cases (the lineage of `rule create --anonymous`).
  - `remote` — collect inputs and call the Taskless service, which runs the heavy
    classifier and returns either a static or a runtime rule (login required).
- **NEW confidence-gated routing contract** — `route` first writes an explicit
  rationale (what `detect` shows, whether an existing linter covers it, whether
  ast-grep can express it, resulting local-solvability confidence), and only then
  names the destination it believes is correct, as a conclusion of that reasoning.
  It commits to a local path on **reasonable** confidence (not certainty); when
  that confidence is absent it selects `remote` directly. Try-verify-escalate is
  the _failure fallback_: a local path committed to in good faith that fails
  verification escalates — but escalation to the generation-consuming, login-gated
  service **prompts and confirms with the user first**, never silently. When
  multiple paths fit, `route` asks the user and explains the trade-offs.
- **MODIFIED skill trigger posture** — naming a specific linter should _engage_
  the authoring flow via `route`, not quiet the skill to a one-line offer.
- This change does **not** define static-vs-runtime classification. That cut is
  owned upstream by the Runtime Rules project and lives behind `remote`; `route`
  only decides local-vs-remote.

## Capabilities

### New Capabilities

- `cli-detect`: A deterministic `taskless detect --json` command that scans the
  working directory for linter configs, languages, and the repo's own
  rule-authoring styles, emitting structured signals for downstream routing. No
  inference, no network.
- `cli-rule-routing`: The `route` / `existing` / `static` / `remote` recipe layer
  and the confidence-gated routing contract that determines the destination
  upfront, keeps authoring local when there is confidence it is locally solvable,
  and routes to the login-gated service directly when that confidence is absent —
  avoiding developer-visible failed local attempts.

### Modified Capabilities

- `cli-help`: Register the four routing topics (`route`, `existing`, `static`,
  `remote`) in the help index and emit their intent telemetry, consistent with
  existing topic registration and embedding requirements.
- `skill-taskless`: Reverse the named-tool suppression clause — when a user names
  a linter or asks to author a rule, the skill routes through
  `npx @taskless/cli help route` instead of quieting. The skill stays a thin
  router and adds no rule knowledge of its own. **Hard constraint:** the skill
  `description` field has a
  1024-character ceiling (Agent Skills spec). Reversing the suppression clause and
  adding routing trigger language compete for that budget, so trigger wording must
  be _tightened_ as this and future capabilities land — not appended. Treat the
  1024-char limit as a gating check whenever the description changes.

## Impact

- **New command**: `packages/cli/src/commands/detect.ts`, registered in
  `packages/cli/src/index.ts`; a `detect` output schema under `schemas/`.
- **New help recipes**: `packages/cli/src/help/{route,existing,static,remote}.txt`,
  embedded via the existing `import.meta.glob` build step.
- **Skill body + description**: `skills/taskless/SKILL.md` routing/trigger text.
- **Reused, unchanged**: `rule create` (remote backend for `remote`),
  `rule verify` (the local verification gate), the canonical on-disk rule
  shape — remote and local paths already write the same files/paths, so
  `check`/`improve`/`verify` see one dialect.
- **Upstream dependency**: the Runtime Rules project (TSKL `Runtime Rules`) owns
  static-vs-runtime; this change references it and never redefines it.
- **No new network dependencies**; `detect` and the local authoring paths are
  offline-capable. Only `remote` requires auth.
