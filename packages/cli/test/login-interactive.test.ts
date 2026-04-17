import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loginInteractive } from "../src/auth/login-interactive";

let cwd: string;
let previousToken: string | undefined;

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "taskless-login-interactive-"));
  previousToken = process.env.TASKLESS_TOKEN;
});

afterEach(async () => {
  if (previousToken === undefined) {
    delete process.env.TASKLESS_TOKEN;
  } else {
    process.env.TASKLESS_TOKEN = previousToken;
  }
  await rm(cwd, { recursive: true, force: true });
});

describe("loginInteractive", () => {
  it("short-circuits with already_logged_in when a token is available", async () => {
    process.env.TASKLESS_TOKEN = "env-token";

    const logs: string[] = [];
    const errors: string[] = [];
    const result = await loginInteractive({
      cwd,
      out: (l) => logs.push(l),
      err: (l) => errors.push(l),
    });

    expect(result.status).toBe("already_logged_in");
    expect(logs).toEqual([]);
    expect(errors).toEqual([]);
  });
});
