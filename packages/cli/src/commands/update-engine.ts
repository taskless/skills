/* eslint-disable unicorn/no-process-exit */
import { resolve } from "node:path";
import { defineCommand } from "citty";

import { getToken } from "../actions/token";
import { readProjectConfig } from "../actions/project-config";
import {
  updateApiProvider,
  type UpdateSubmitResponse,
  type UpdateStatusResponse,
} from "../actions/update-api";

const POLL_INTERVAL_MS = 5_000;

export const updateEngineCommand = defineCommand({
  meta: {
    name: "update-engine",
    description:
      "Request a scaffold upgrade PR to update the .taskless/ engine directory",
  },
  args: {
    dir: {
      type: "string",
      alias: "d",
      description: "Working directory",
    },
    json: {
      type: "boolean",
      description: "Output as JSON",
      default: false,
    },
  },
  async run({ args }) {
    const cwd = resolve(args.dir ?? process.cwd());

    // 1. Read project config
    let config;
    try {
      config = await readProjectConfig(cwd);
    } catch (error) {
      if (args.json) {
        console.log(
          JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          })
        );
      } else {
        console.error(
          `Error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      process.exit(1);
    }

    if (config.orgId === undefined || config.repositoryUrl === undefined) {
      const message =
        'Missing "orgId" or "repositoryUrl" in .taskless/taskless.json. Run `taskless init` to set up your project.';
      if (args.json) {
        console.log(JSON.stringify({ error: message }));
      } else {
        console.error(`Error: ${message}`);
      }
      process.exit(1);
    }

    // 2. Resolve auth token
    const token = await getToken();
    if (!token) {
      const message =
        "Authentication required. Run `taskless auth login` first.";
      if (args.json) {
        console.log(JSON.stringify({ error: message }));
      } else {
        console.error(`Error: ${message}`);
      }
      process.exit(1);
    }

    // 3. Submit update request
    let submitResponse: UpdateSubmitResponse;
    try {
      submitResponse = await updateApiProvider.submitUpdate(token, {
        orgId: config.orgId,
        repositoryUrl: config.repositoryUrl,
        version: config.version,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (args.json) {
        console.log(JSON.stringify({ error: message }));
      } else {
        console.error(`Error: ${message}`);
      }
      process.exit(1);
    }

    // 4. Handle immediate responses
    if (submitResponse.status === "current") {
      if (args.json) {
        console.log(JSON.stringify({ status: "current" }));
      } else {
        console.log("Your project is already up to date.");
      }
      return;
    }

    if (submitResponse.status === "exists") {
      if (args.json) {
        console.log(
          JSON.stringify({
            status: "exists",
            requestId: submitResponse.requestId,
            prUrl: submitResponse.prUrl,
          })
        );
      } else {
        console.log(
          `An update PR already exists: ${submitResponse.prUrl}\nReview and merge it to complete the upgrade.`
        );
      }
      return;
    }

    // 5. Poll for completion (status: "accepted")
    const { requestId } = submitResponse;
    console.error("Update request accepted. Waiting for PR creation...");

    while (true) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      let pollResponse: UpdateStatusResponse;
      try {
        pollResponse = await updateApiProvider.pollStatus(token, requestId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (args.json) {
          console.log(JSON.stringify({ error: message }));
        } else {
          console.error(`Error: ${message}`);
        }
        process.exit(1);
      }

      switch (pollResponse.status) {
        case "pending": {
          console.error("Status: pending — waiting for PR creation...");
          break;
        }
        case "open": {
          if (args.json) {
            console.log(
              JSON.stringify({ status: "open", prUrl: pollResponse.prUrl })
            );
          } else {
            console.log(
              `Update PR created: ${pollResponse.prUrl}\nReview and merge it to complete the upgrade.`
            );
          }
          return;
        }
        case "merged": {
          if (args.json) {
            console.log(
              JSON.stringify({ status: "merged", prUrl: pollResponse.prUrl })
            );
          } else {
            console.log(
              `The update PR has already been merged: ${pollResponse.prUrl}\nPull your branch to pick up the changes.`
            );
          }
          return;
        }
        case "closed": {
          if (args.json) {
            console.log(
              JSON.stringify({ status: "closed", prUrl: pollResponse.prUrl })
            );
          } else {
            console.log(
              `The update PR was closed: ${pollResponse.prUrl}\nRe-run \`taskless update-engine\` to create a new one.`
            );
          }
          return;
        }
      }
    }
  },
});
