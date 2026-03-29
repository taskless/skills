---
"@taskless/cli": patch
---

Fix CLI auth to check token expiry instead of just token existence, preventing commands from reporting a logged-in state with an expired JWT
