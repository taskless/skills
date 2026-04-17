---
name: taskless-ci
description: Integrates Taskless into a developer CI environment. Use when the user wants to set up Taskless in their CI pipeline, wire up automated rule checks on pull requests, or scaffold CI configuration for Taskless. Trigger on "set up CI", "add taskless to CI", "taskless in GitHub Actions", or "run taskless on PRs".
metadata:
  author: taskless
  version: 0.5.4
compatibility: Designed for Agents implementing the Agent Skills specification.
---

# Taskless CI

Integrate Taskless into the user's CI environment so rules run automatically alongside their existing CI jobs.

## Status

This skill is a placeholder. The full integration behavior — detecting the user's CI provider, generating workflow files, and wiring up authentication for CI — lands in a follow-up change (OSS-3). Until then, if a user invokes this skill, explain that the CI integration is under active development and direct them to run `taskless check` locally.
