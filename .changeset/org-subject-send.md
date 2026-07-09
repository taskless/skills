---
"@taskless/cli": minor
---

Send the acting organization's identity on every write request. The CLI now resolves which Taskless org owns the current repository by matching the repo's git remotes (`origin` → `upstream` → rest) against the canonical owner URLs returned by `whoami`, and sends that org's Taskless UUID as the subject on rule generation, iterate, and reconcile calls. This fixes multi-org users being routed to whichever org their token happened to pin; the server authorizes the chosen org per request. When no remote matches a known org, the CLI falls back to the token's numeric `orgId` claim, so single-org behavior is unchanged.

The client-side owner-URL canonicalizer is a verbatim port of the server's shared implementation, so both sides compare by exact string equality across SSH, `ssh://`/`git://`, port, and `www.` remote forms.

`rule create`/`rule improve` now handle two additional generation states: `classifying` (a transient pre-build phase) and `unsupported`, a terminal state emitted when the request needs a capability the organization's plan doesn't include (for example, runtime rules) — surfaced with a clear message and the new `RULE_UNSUPPORTED` error code. When the server can't act on a repository for the selected org (its GitHub App installation doesn't cover the repo, or membership changed), the CLI now explains the coverage cause rather than only suggesting re-authentication.
