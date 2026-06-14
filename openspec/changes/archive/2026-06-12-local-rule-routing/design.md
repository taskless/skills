## Context

The Taskless skill is a thin router: it holds no recipes and delegates to
`npx @taskless/cli help <topic>`, which returns a bundled `.txt` recipe embedded
at build time. Today the only authoring entry is `rule create`, which is
rule-type-agnostic, login-gated, and runs generation off the developer's machine
via the Taskless service. The service-side classifier that decides static vs
runtime (`classifyStep`, Runtime Rules project) is **not reachable locally** —
it is login-only by design, because it carries inference off-machine.

Three constraints shape this design:

1. **No local classifyStep.** The local path cannot call the service classifier.
   It must make a coarser, cheaper decision on-device.
2. **Login is a wall.** Reaching the service requires auth. Sending a user there
   unnecessarily is the failure mode we are designing against.
3. **The skill adds no rule knowledge.** Per the existing router philosophy, all
   judgment lives in fetched recipes; the CLI ships deterministic signals and
   recipe text, never a maintained catalog of linter rules.

The check pipeline already models multi-scanner aggregation (`source` field), and
remote rule generation already writes the same on-disk shape and paths as local
generation (canonical shape pinned by the Runtime Rules project). So downstream
tools (`check`, `improve`, `verify`) see a single dialect regardless of origin.

## Goals / Non-Goals

**Goals:**

- A deterministic, offline `taskless detect --json` that reports repo signals
  (linters configured, languages, the repo's own rule styles).
- A local routing recipe (`route`) that reasons first, then commits to the
  believed-correct destination (`existing | static | remote`) on reasonable
  confidence, biased to stay local.
- Try-verify-escalate as the _failure fallback_: a path committed to on reasonable
  belief that fails verification escalates — and escalation to the service prompts
  and confirms with the user before spending a generation.
- Asking the user when multiple paths fit, with trade-offs (including the
  generation cost of `remote`).
- Authoring recipes for each destination (`existing`, `static`, `remote`).
- Reverse the skill's named-tool suppression so naming a linter engages routing.

**Non-Goals:**

- Defining or computing static-vs-runtime classification locally. That cut is
  owned by the Runtime Rules project and lives behind `remote`.
- Maintaining any catalog/knowledge-graph of linter rules or a `howto` API
  (explicitly rejected — see Decisions). Linter knowledge is sourced at author
  time from the repo and the agent's WebSearch/WebFetch.
- Changing the `rule create` remote backend, the canonical on-disk rule shape, or
  `check`/`improve`/`verify` behavior.
- Running external linters inside `taskless check` (the `existing` path is
  author-only; the user's own toolchain runs the rule).

## Decisions

### D1 — `detect` is a real command; routing is recipes

`taskless detect --json` is an executable, deterministic command. `route`,
`existing`, `static`, `remote` are `help` recipes the agent follows.

_Why:_ A CLI cannot classify natural-language intent without an LLM, so the
"what kind of rule is this" judgment must live in a recipe the agent executes.
But "what linters/languages are present" is pure signal and benefits from
determinism — making it a command gives the recipe a stable, testable input and
keeps the agent from hallucinating the repo's tooling.

_Alternative considered:_ a single `taskless route "<request>"` command that
classifies directly. Rejected — it would need an on-device LLM call or a brittle
heuristic, and it couples a deterministic signal scan to a judgment that belongs
in the agent.

### D2 — `route` commits to the believed-correct path; escalation is the failure fallback

`route` determines the destination **upfront** from `detect` signals plus intent,
choosing the path it _believes_ is correct. The bar to commit to a local path is
**reasonable confidence**, not certainty — because the safety net is an honest
fallback, not a perfect prediction. The flow:

```
route (reason FIRST, then decide, then act):
  0. write the rationale BEFORE naming a destination:
       - what the `detect` signals show (linters, languages, repo rule styles)
       - whether an existing linter plausibly already covers this
       - whether the pattern is expressible as a simple static ast-grep rule
       - the resulting confidence that it is locally solvable
  1. existing AND static both fit?         -> ASK the user, explain trade-offs (D8)
  2. existing linter clearly fits?         -> existing                     (no login)
  3. reasonably confident simple static?   -> static (author + verify)     (no login)
  4. not reasonably confident it's local?  -> remote                       (login)

  FALLBACK (failure state): a path we believed in (static) fails verification
     -> PROMPT the user and CONFIRM before calling the service
        ("local rule couldn't capture the cases; generate via Taskless?
          this uses a generation and needs login") -> on yes -> remote
```

The destination is emitted **after** the rationale and must follow from it. The
recipe forbids naming a route before the reasoning is written.

_Why (reason-before-route):_ Confidence assessments are unreliable when the model
names a destination first and justifies it after — it rationalizes a snap call.
Requiring the rationale to be written _before_ the route is named conditions the
decision on the contextual work (what `detect` shows, whether a packaged rule
exists, whether ast-grep can express the pattern), so the confidence judgment is
earned rather than asserted. The route must be a conclusion of the reasoning.

_Why (commit on reasonable confidence, not certainty):_ Demanding high confidence
to act locally would push borderline-but-solvable requests to the service
unnecessarily — and the service costs generations (D8). Reasonable confidence is
enough to _commit_ to local because try-verify-escalate backstops a wrong bet:
the `static` recipe authors the rule and verifies it against the user's cases, and
if that believed-correct attempt fails, the recipe escalates. This is the
legitimate role of try-verify-escalate — a **failure handler for a path we
believed in**, not a route-selection probe.

_Why escalation prompts and confirms:_ The service consumes a generation and
requires login. A local attempt that fails must NOT silently fall through to the
service — the recipe surfaces the failure and asks the user to confirm the
service call. This keeps generations from being spent without consent and makes
the (now justified) login ask explicit.

_The distinction that matters:_ what is rejected is **fail-first as the selection
mechanism** — deliberately attempting local with no real belief it will work, just
to manufacture a justification for `remote`. What is kept is **try-verify-escalate
as a fallback** — committing to local on reasonable belief, and escalating (with
confirmation) only when that genuine attempt fails. `route` never names "runtime";
it only judges "am I reasonably confident this is a simple local rule?" and, when
not, routes remote upfront.

_Alternative considered (rejected):_ escalate to `remote` on _uncertainty alone_.
Rejected — uncertainty must not by itself send users to a generation-consuming,
login-gated path; only a reasoned judgment (confident-local, or a verified local
failure) drives the choice.

### D3 — `detect` emits pure repo signals only; no rule-pattern detection

`detect` reports linters present, languages, and the repo's own rule-authoring
styles. It does **not** try to match a request against known packaged rules
(e.g. "this is `no-console`").

_Why:_ The space of packaged-rule detections is effectively infinite and changes
constantly across ecosystems — a poor determinism target that would drag a
maintained catalog back into the CLI. That judgment is cheap for the LLM in the
`existing` recipe (repo + WebFetch) and expensive to keep correct in code.

_Why no `frameworks` signal:_ An earlier cut also reported detected frameworks
(React, Django, …). It was dropped: the sole consumer is `route`, whose rationale
(D2 step 0) reads linters, languages, and repo rule styles — never frameworks.
Framework presence does not change which authoring destination fits, so emitting
it was unused surface. Dropping it aligns the contract with its consumer.

_Detection shape (languages → linters):_ languages are inferred first (manifest
and marker files), then each linter is probed. A linter is tagged with the
language(s) it serves, so its dependency evidence is read from that language's
own manifest — a node dependency from `package.json`, a Python dependency from
`pyproject.toml`/`requirements.txt` — instead of conflating ecosystems. Config
files are parsed with real parsers (`smol-toml` for `pyproject.toml`, alongside
the existing `yaml`); a malformed manifest drops only its own derived signal and
never fails the scan, because other files in the repo are independent tells. A
config file present on disk is honored regardless of inferred language, per the
"Linter configs are detected from disk" requirement.

### D4 — Knowledge is sourced at author time, not maintained by Taskless

The `existing` recipe instructs the agent to mine the repo's own rules of the
relevant kind first, then WebFetch the linter's current docs only if that is
thin. Taskless ships the recipe (where to look), not the knowledge.

_Why:_ A Taskless-hosted knowledge graph / `howto` endpoint is WebSearch/WebFetch
in disguise with a perpetual scraping-and-staleness maintenance bill. The agent
already has fresh web access; the repo is the highest-signal source for house
style. (There is precedent for `/cli/api/*` endpoints if server-fresh recipes are
ever needed, but bundled-first / API-as-enrichment remains the posture.)

### D5 — `route` replaces `rule create` as the authoring front door

The skill and topic index point "author a rule" requests at `route`, not directly
at `rule create`. `rule create` remains the executable backend that the `remote`
recipe invokes; it is unchanged.

_Why:_ It inserts the local-first decision before any login-gated path, without
disturbing the working remote backend.

### D6 — Local `static` output matches the canonical shape

The `static` recipe writes the same on-disk rule shape and paths as remote
generation (the canonical shape pinned upstream).

_Why:_ `check`, `improve`, and `verify` must see one dialect. Divergent local vs
remote output would fork all three downstream tools.

### D7 — The skill `description` 1024-char ceiling is a gating check, not an afterthought

The Agent Skills spec caps the skill `description` at 1024 characters. Reversing
the named-tool suppression and adding routing trigger language both consume that
budget. Every edit to the description SHALL be measured against 1024, and trigger
wording SHALL be tightened (reworded shorter) rather than appended when the budget
is tight.

_Why:_ The description is the skill's trigger surface; silently overflowing 1024
breaks loading or truncates triggers. Capturing the limit as a first-class
constraint now — before more capabilities pile trigger phrases onto the field —
prevents a later capability from being blocked by a full description. This is why
the constraint is surfaced in the proposal and carries an explicit length
scenario in the spec, not just a code comment.

### D8 — When multiple paths fit, ask the user and explain trade-offs

When more than one destination genuinely fits — most often `existing` and `static`
both viable — `route` SHALL present the options to the user with their trade-offs
rather than silently picking one. The trade-off framing SHALL include that the
service path (`remote`) consumes a generation and requires login, so it is the
right tool when something _cannot_ be solved locally, not a default.

_Why:_ When two local paths both work, the choice is a user preference (which
toolchain owns the rule), not a technical fact the recipe should decide for them.
Surfacing it builds trust and keeps the user in control of where their rules live.
Naming the generation cost of `remote` makes the local-first bias legible: the
service is valuable precisely when local can't deliver, and spending a generation
should be a conscious choice.

_Resolves open question:_ "should `route` offer `existing` and `static` in
parallel?" — yes, when both fit or the agent is unsure, ask and explain.

## Risks / Trade-offs

- **[`route` is over-confident and commits local when it shouldn't]** → The
  `static` recipe verifies the authored rule against the user's success/failure
  cases before reporting success, so a wrong-but-reasonable local bet surfaces as a
  verified failure, not a silently bad rule. That failure escalates via try-verify-
  escalate — the legitimate fallback — and the escalation prompts-and-confirms
  before spending a generation, so an over-confident bet costs at most a confirm
  dialog, never a silent service charge.
- **[`route` demands too much confidence and pushes solvable requests to the
  service]** → The commit bar is _reasonable_ confidence, not certainty (D2),
  precisely because the fallback backstops a wrong bet cheaply. Tuned with the
  honesty eval fixtures across both failure directions.
- **[Reversing suppression pushes the skill `description` over the 1024-char Agent
  Skills ceiling]** → The 1024 limit is a gating check on every description edit
  (D7); trigger wording is tightened, not appended, and the spec carries an
  explicit length scenario.
- **[`existing` author-only confuses users who expect `taskless check` to run
  their linter]** → Recipe text must be explicit that the user's own toolchain
  runs the authored rule; Taskless does not aggregate external linters in v1.
- **[Recipe drift vs the Runtime Rules canonical shape]** → D6 ties local output
  to the upstream shape; verification (`rule verify`) catches shape regressions.
- **[Skill trigger reversal causes false engagement on tool-named requests]** →
  The trigger still anchors on rule-authoring intent; naming a linter routes to
  `route`, which can still conclude "this is a one-line config in your existing
  tool" without heavy machinery.

## Migration Plan

1. Ship `detect` (additive command, no behavior change to existing commands).
2. Add the four recipes and register them in the help index (additive).
3. Update `skill-taskless` trigger/router text to engage `route`. This is the
   only behavior change users perceive; it is reversible by restoring the
   suppression clause.
4. No data migration; no change to on-disk rule shape or stored state.

Rollback: revert the skill text and unregister the recipes; `detect` can remain
harmlessly as an unused command.

## Resolved Questions

- **Offer `existing` and `static` in parallel when both fit?** Resolved (D8): yes
  — when both fit or the agent is unsure, ask the user and explain trade-offs,
  including that `remote` consumes a generation and is for what can't be solved
  locally.
- **How confident is "confident enough" to commit to `static`?** Resolved (D2):
  _reasonably_ confident, not certain — because try-verify-escalate (with a
  prompt-and-confirm before the service) backstops a wrong-but-reasonable bet, so
  borderline-solvable requests are not pushed to the service unnecessarily. The
  honesty eval fixtures calibrate the threshold in recipe language.
- **Where does the `static` candidate live and how is it cleaned up on fallback?**
  Resolved: mirror the existing `.taskless/.tmp-*` + guaranteed-cleanup pattern
  from `rule create` (cleanup on both success and failure).

## Open Questions

- None outstanding.
