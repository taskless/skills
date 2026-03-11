---
"@taskless/cli": patch
---

Fix `rules create` requiring scaffold version 2026-03-03 which doesn't exist yet, causing users on the latest scaffold (2026-03-02) to be told to update when they're already current
