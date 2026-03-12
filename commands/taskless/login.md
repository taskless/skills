---
name: "Taskless: Login"
description: Explains how to authenticate with Taskless. Use when the user wants to log in, authenticate, connect their account, or set up credentials. Trigger on "taskless login", "authenticate taskless", "taskless auth", or "connect to taskless".
category: Taskless
tags:
  - taskless
metadata:
  author: taskless
  version: 0.1.4
  commandName: taskless:login
---

# Taskless Login

When this skill is invoked, explain the authentication process and provide the CLI command the user needs to run.

**Important:** Do NOT attempt to run the login command. The device flow requires interactive terminal input (displaying a URL and polling for browser-based authorization) that cannot be performed by an agent.

## Instructions

1. **Read current command documentation.** Run `pnpm dlx @taskless/cli@latest help auth login` and read the output. Use this to understand the login flow, credential storage, and alternatives.

2. **Present the login command and explain the process.** Using the information from the help output, display the command the user should run in their terminal and explain what will happen (device flow, credential storage, environment variable alternative).
