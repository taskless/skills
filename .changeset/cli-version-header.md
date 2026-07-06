---
"@taskless/cli": minor
---

Send an `x-taskless-cli-version` header on every request to the Taskless service (rule generation, reconcile, `whoami`, and the device-auth flow) declaring the CLI's version. The service uses this to gate capability-dependent responses — notably runtime rules — on the CLI being new enough to handle them; a request without the header is treated as a pre-runtime CLI. The version is also emitted with the CLI's telemetry so usage is recorded client-side rather than inferred server-side.
