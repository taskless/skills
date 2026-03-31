---
"@taskless/cli": minor
---

Remove global XDG auth token storage (`~/.config/taskless/auth.json`) in favor of per-repo tokens only. Authentication is now scoped to each repository via `.taskless/.env.local.json`. A deprecation notice is shown when a legacy global token file is detected. The device flow now sends a repository URL hint to the auth server.
