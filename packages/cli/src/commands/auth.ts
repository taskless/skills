import { resolve } from "node:path";
import { defineCommand } from "citty";

import { deviceFlowProvider } from "../auth/device-flow";
import { getToken, removeToken, saveToken } from "../auth/token";
import { resolveRepositoryUrl } from "../util/git-remote";
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

    const existing = await getToken(cwd);
    if (existing) {
      console.log("You are already logged in.");
      console.log("Run `taskless auth logout` first to re-authenticate.");
      return;
    }

    try {
      let repositoryUrl: string | undefined;
      try {
        repositoryUrl = await resolveRepositoryUrl(cwd);
      } catch {
        // Not a git repo or no origin — proceed without hint
      }

      const deviceCode =
        await deviceFlowProvider.requestDeviceCode(repositoryUrl);

      console.log(`\nOpen this URL in your browser:\n`);
      console.log(
        `  ${deviceCode.verification_uri_complete ?? deviceCode.verification_uri}\n`
      );
      console.log(`Enter code: ${deviceCode.user_code}\n`);
      console.log("Waiting for authorization...");

      const intervalMs = deviceCode.interval * 1000;
      const expiresAt = Date.now() + deviceCode.expires_in * 1000;
      let currentInterval = intervalMs;

      while (Date.now() < expiresAt) {
        await new Promise((resolve) => setTimeout(resolve, currentInterval));

        const result = await deviceFlowProvider.pollForToken(
          deviceCode.device_code
        );

        switch (result.status) {
          case "success": {
            await saveToken(result.token, cwd);
            telemetry.capture("cli_auth_login_completed");
            console.log("Logged in successfully.");
            return;
          }
          case "slow_down": {
            currentInterval += 5000;
            break;
          }
          case "expired": {
            console.error("Device code expired. Please try again.");
            process.exitCode = 1;
            return;
          }
          case "denied": {
            console.error("Authorization denied.");
            process.exitCode = 1;
            return;
          }
          case "pending": {
            break;
          }
        }
      }

      console.error("Device code expired. Please try again.");
      process.exitCode = 1;
    } catch (error) {
      console.error(
        error instanceof Error ? error.message : "Authentication failed."
      );
      process.exitCode = 1;
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
  subCommands: {
    login: loginCommand,
    logout: logoutCommand,
  },
});
