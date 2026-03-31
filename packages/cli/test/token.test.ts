import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getToken, saveToken, removeToken } from "../src/auth/token";

let temporaryDirectory: string;

beforeEach(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "taskless-token-test-"));
  vi.stubEnv("XDG_CONFIG_HOME", temporaryDirectory);
  delete process.env.TASKLESS_TOKEN;
});

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  await rm(temporaryDirectory, { recursive: true, force: true });
});

/** Write a raw auth.json to the temp config directory */
async function writeAuthFile(data: Record<string, unknown>): Promise<void> {
  const directory = join(temporaryDirectory, "taskless");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "auth.json"), JSON.stringify(data));
}

/** Read the raw auth.json from the temp config directory */
async function readAuthFile(): Promise<Record<string, unknown>> {
  const raw = await readFile(
    join(temporaryDirectory, "taskless", "auth.json"),
    "utf8"
  );
  return JSON.parse(raw) as Record<string, unknown>;
}

describe("getToken", () => {
  describe("valid token", () => {
    it("returns the token when expires_at is in the future", async () => {
      await writeAuthFile({
        access_token: "valid-token",
        expires_at: Date.now() + 60_000,
      });
      expect(await getToken()).toBe("valid-token");
    });

    it("returns the token when no expires_at is stored (legacy auth files)", async () => {
      await writeAuthFile({ access_token: "legacy-token" });
      expect(await getToken()).toBe("legacy-token");
    });
  });

  describe("expired token", () => {
    it("returns undefined when expires_at is in the past", async () => {
      await writeAuthFile({
        access_token: "expired-token",
        expires_at: Date.now() - 1000,
      });
      expect(await getToken()).toBeUndefined();
    });

    it("returns undefined when expires_at is exactly now", async () => {
      const now = Date.now();
      vi.useFakeTimers();
      vi.setSystemTime(now);
      await writeAuthFile({
        access_token: "edge-token",
        expires_at: now,
      });
      expect(await getToken()).toBeUndefined();
    });
  });

  describe("missing data", () => {
    it("returns undefined when auth file does not exist", async () => {
      expect(await getToken()).toBeUndefined();
    });

    it("returns undefined when access_token is missing from file", async () => {
      await writeAuthFile({ expires_at: Date.now() + 60_000 });
      expect(await getToken()).toBeUndefined();
    });
  });

  describe("corrupted data", () => {
    it("returns undefined when auth file contains invalid JSON", async () => {
      const directory = join(temporaryDirectory, "taskless");
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, "auth.json"), "not-json{{{");
      expect(await getToken()).toBeUndefined();
    });

    it("returns undefined when auth file is empty", async () => {
      const directory = join(temporaryDirectory, "taskless");
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, "auth.json"), "");
      expect(await getToken()).toBeUndefined();
    });

    it("returns token when expires_at is not a number (treated as no expiry)", async () => {
      await writeAuthFile({
        access_token: "bad-expiry",
        expires_at: "not-a-number",
      });
      // Non-numeric expires_at fails the typeof guard, so token is returned
      expect(await getToken()).toBe("bad-expiry");
    });
  });

  describe("env var override", () => {
    it("returns TASKLESS_TOKEN env var regardless of file state", async () => {
      await writeAuthFile({
        access_token: "file-token",
        expires_at: Date.now() - 1000, // expired
      });
      process.env.TASKLESS_TOKEN = "env-token";
      expect(await getToken()).toBe("env-token");
    });
  });
});

describe("saveToken", () => {
  it("computes expires_at from expires_in", async () => {
    const before = Date.now();
    await saveToken({
      access_token: "new-token",
      expires_in: 3600,
    });
    const after = Date.now();

    const saved = await readAuthFile();
    expect(saved.access_token).toBe("new-token");
    expect(saved.expires_in).toBe(3600);
    expect(typeof saved.expires_at).toBe("number");
    expect(saved.expires_at as number).toBeGreaterThanOrEqual(
      before + 3600 * 1000
    );
    expect(saved.expires_at as number).toBeLessThanOrEqual(after + 3600 * 1000);
  });

  it("does not set expires_at when expires_in is not provided", async () => {
    await saveToken({ access_token: "no-expiry-token" });
    const saved = await readAuthFile();
    expect(saved.access_token).toBe("no-expiry-token");
    expect(saved).not.toHaveProperty("expires_at");
  });
});

describe("removeToken", () => {
  it("returns true and removes the file when it exists", async () => {
    await saveToken({ access_token: "to-remove" });
    expect(await removeToken()).toBe(true);
    expect(await getToken()).toBeUndefined();
  });

  it("returns false when no auth file exists", async () => {
    expect(await removeToken()).toBe(false);
  });
});
