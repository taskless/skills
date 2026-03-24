---
"@taskless/cli": minor
---

Replace hand-written fetch calls with a typed API client powered by `openapi-fetch` and `openapi-typescript`. Request and response types are now generated from the OpenAPI schema at `.generated/schema.json`, removing manual type definitions for API interactions. Rule file types (`GeneratedRule`, etc.) are now derived from the schema.
