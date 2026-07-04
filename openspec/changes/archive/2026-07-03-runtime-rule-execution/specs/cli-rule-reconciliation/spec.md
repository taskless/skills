## RENAMED Requirements

- FROM: `### Requirement: Reconcile reports every held rule file`
- TO: `### Requirement: Reconcile reports every runtime rule's check.ts`

## MODIFIED Requirements

### Requirement: Reconcile reports every runtime rule's check.ts

Reconciliation SHALL be scoped to the **`check.ts` of runtime rules** — the only artifact that
carries arbitrary code execution. Static ast-grep rules and runtime-rule capture `*.yml` are
inert data, always available, and SHALL NOT be reported to or gated by reconciliation. The CLI
SHALL reconcile by sending `POST /cli/api/reconcile` with an `Authorization: Bearer <cli-token>`
header and a JSON body `{ repositoryUrl, files }`, where `repositoryUrl` is the full repository
URL and `files` is an array of `{ file, signature }` covering the `check.ts` of **every**
runtime rule the CLI holds under `.taskless/runtime-rules/`. `file` SHALL be the `check.ts`'s
delivered path as it exists on disk and `signature` SHALL be the full envelope computed for its
bytes. The CLI SHALL send the whole signature envelope, not a bare digest.

#### Scenario: Every runtime rule's check.ts is reported

- **WHEN** the CLI reconciles with runtime rules present under `.taskless/runtime-rules/`
- **THEN** the request body SHALL include one `{ file, signature }` entry for the `check.ts` of each runtime rule

#### Scenario: Inert files are not reported

- **WHEN** the CLI reconciles and static `*.yml` rules and capture `*.yml` are also present
- **THEN** the request body SHALL NOT include entries for those inert files
- **AND** the static rules SHALL run regardless of the reconcile response

#### Scenario: Full envelope is sent

- **WHEN** the CLI reports a file's signature
- **THEN** it SHALL send the complete `1;h=sha-256;d=<hex>` envelope, not only the digest

### Requirement: The CLI executes only the server run set

When reconciliation succeeds, the CLI SHALL execute a runtime rule only if its **`check.ts`**
is present in the server's `run` set, and SHALL execute no runtime rule whose `check.ts` is
absent from `run`. The CLI SHALL NOT run a runtime rule on the basis of its own local
comparison of signatures. This replaces any local classification of runtime rules. Static
ast-grep rules and capture `*.yml` are outside this gate.

#### Scenario: Only rules with a blessed check.ts execute

- **WHEN** reconciliation returns a `run` set covering the `check.ts` of some runtime rules but not others
- **THEN** the CLI SHALL execute only the runtime rules whose `check.ts` is in `run`
- **AND** SHALL withhold any runtime rule whose `check.ts` is absent from `run`

#### Scenario: No local self-classification

- **WHEN** the CLI holds a local signature or sidecar for a runtime rule's `check.ts`
- **THEN** it SHALL NOT treat that local value as authorization to execute the rule
