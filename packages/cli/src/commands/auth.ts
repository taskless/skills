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
    anonymous: {
      type: "boolean",
      description: "Rejected: auth commands cannot be anonymous",
      default: false,
    },
  },
  async run({ args }) {
    const cwd = resolve(args.dir ?? process.cwd());
    const telemetry = await getTelemetry(cwd);
    const startedAt = Date.now();
    telemetry.capture("cli_auth_login");

    if (args.anonymous) {
      console.error("Error: auth commands cannot be anonymous.");
      process.exitCode = 1;
      telemetry.capture("cli_auth_login_completed", {
        success: false,
        durationMs: Date.now() - startedAt,
      });
      return;
    }

    let success = false;
    try {
      const result = await loginInteractive({ cwd });

      switch (result.status) {
        case "ok": {
          success = true;
          return;
        }
        case "already_logged_in": {
          console.log("You are already logged in.");
          console.log("Run `taskless auth logout` first to re-authenticate.");
          success = true;
          return;
        }
        case "cancelled": {
          process.exitCode = 1;
          return;
        }
      }
    } finally {
      telemetry.capture("cli_auth_login_completed", {
        success,
        durationMs: Date.now() - startedAt,
      });
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
    anonymous: {
      type: "boolean",
      description: "Accepted for compatibility; logout is already local",
      default: false,
    },
  },
  async run({ args }) {
    const cwd = resolve(args.dir ?? process.cwd());
    const telemetry = await getTelemetry(cwd);
    const startedAt = Date.now();
    telemetry.capture("cli_auth_logout");

    let success = false;
    try {
      const removed = await removeToken(cwd);
      if (removed) {
        console.log("Logged out.");
      } else {
        console.log("Not logged in.");
      }
      success = true;
    } finally {
      telemetry.capture("cli_auth_logout_completed", {
        success,
        durationMs: Date.now() - startedAt,
      });
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
    const startedAt = Date.now();
    telemetry.capture("cli_auth_status");

    let success = false;
    try {
      const token = await getToken(cwd);
      if (!token) {
        console.log("Not logged in.");
        console.log("Run `taskless auth login` to authenticate.");
        success = true;
        return;
      }

      const whoami = await fetchWhoami(token);
      if (!whoami) {
        console.log("Logged in, but unable to verify identity.");
        console.log(
          "Your token may be invalid or expired. Run `taskless auth login` to re-authenticate."
        );
        success = true;
        return;
      }

      const orgs = whoami.orgs.map((o) => o.name);
      const orgSuffix = orgs.length > 0 ? ` (${orgs.join(", ")})` : "";
      console.log(`Logged in as ${whoami.user}${orgSuffix}.`);
      success = true;
    } finally {
      telemetry.capture("cli_auth_status_completed", {
        success,
        durationMs: Date.now() - startedAt,
      });
    }
  },
});
