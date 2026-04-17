import { resolve } from "node:path";
import { defineCommand } from "citty";

import { loginInteractive } from "../auth/login-interactive";
import { getToken, removeToken } from "../auth/token";
import { fetchWhoami } from "../auth/whoami";
import { getTelemetry } from "../telemetry";

const loginCommand = defineCommand({
  meta: {
    name: "login",
    description: "Authenticate with taskless.io",
  },
  args: {
    dir: {
      type: "string",
      alias: "d",
      description: "Working directory",
    },
  },
  async run({ args }) {
    const cwd = resolve(args.dir ?? process.cwd());
    const telemetry = await getTelemetry(cwd);
    telemetry.capture("cli_auth_login");

    const result = await loginInteractive({ cwd });

    switch (result.status) {
      case "ok": {
        telemetry.capture("cli_auth_login_completed");
        return;
      }
      case "already_logged_in": {
        console.log("You are already logged in.");
        console.log("Run `taskless auth logout` first to re-authenticate.");
        return;
      }
      case "cancelled": {
        process.exitCode = 1;
        return;
      }
    }
  },
});

const logoutCommand = defineCommand({
  meta: {
    name: "logout",
    description: "Remove saved authentication",
  },
  args: {
    dir: {
      type: "string",
      alias: "d",
      description: "Working directory",
    },
  },
  async run({ args }) {
    const cwd = resolve(args.dir ?? process.cwd());
    const telemetry = await getTelemetry(cwd);
    telemetry.capture("cli_auth_logout");

    const removed = await removeToken(cwd);
    if (removed) {
      console.log("Logged out.");
    } else {
      console.log("Not logged in.");
    }
  },
});

export const authCommand = defineCommand({
  meta: {
    name: "auth",
    description: "Manage authentication with taskless.io",
  },
  args: {
    dir: {
      type: "string",
      alias: "d",
      description: "Working directory",
    },
  },
  subCommands: {
    login: loginCommand,
    logout: logoutCommand,
  },
  async run({ args, rawArgs }) {
    // citty always calls the parent's run handler, even after a subcommand.
    // Only show status when no subcommand was provided.
    if (rawArgs.some((argument) => !argument.startsWith("-"))) {
      return;
    }

    const cwd = resolve(args.dir ?? process.cwd());
    const telemetry = await getTelemetry(cwd);
    telemetry.capture("cli_auth_status");

    const token = await getToken(cwd);
    if (!token) {
      console.log("Not logged in.");
      console.log("Run `taskless auth login` to authenticate.");
      return;
    }

    const whoami = await fetchWhoami(token);
    if (!whoami) {
      console.log("Logged in, but unable to verify identity.");
      console.log(
        "Your token may be invalid or expired. Run `taskless auth login` to re-authenticate."
      );
      return;
    }

    const orgs = whoami.orgs.map((o) => o.name);
    const orgSuffix = orgs.length > 0 ? ` (${orgs.join(", ")})` : "";
    console.log(`Logged in as ${whoami.user}${orgSuffix}.`);
  },
});
