import { confirm, log, note } from "@clack/prompts";

import { getToken } from "../../auth/token";
import { loginInteractive } from "../../auth/login-interactive";
import { ask } from "../ask";

export interface AuthStepResult {
  /** True when the step was actually shown (user was not already logged in). */
  prompted: boolean;
  /** True when the user ended the step with a valid token. */
  loggedIn: boolean;
}

export async function promptAuth(cwd: string): Promise<AuthStepResult> {
  const existing = await getToken(cwd, { silent: true });
  if (existing) {
    return { prompted: false, loggedIn: true };
  }

  note(
    [
      "Taskless can work without an account, but authenticated rules retain",
      "conversation history across teammates — great for rule provenance",
      '("why do we have this rule?").',
    ].join("\n"),
    "Authentication"
  );

  const wantsLogin = await ask("auth", () =>
    confirm({
      message: "Log in to taskless.io now?",
      initialValue: false,
    })
  );

  if (!wantsLogin) {
    log.info(
      "You can run `taskless auth login` at any time to authenticate later."
    );
    return { prompted: true, loggedIn: false };
  }

  const result = await loginInteractive({ cwd });
  return {
    prompted: true,
    loggedIn: result.status === "ok" || result.status === "already_logged_in",
  };
}
