import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const binPath = resolve(import.meta.dirname, "../dist/index.js");

describe("cli", () => {
  it("has a shebang in the built output", async () => {
    const content = await readFile(binPath, "utf8");
    expect(content.startsWith("#!/usr/bin/env node\n")).toBe(true);
  });

  describe("info", () => {
    it("outputs version as JSON", async () => {
      const { stdout } = await execFileAsync("node", [binPath, "info"]);
      const parsed = JSON.parse(stdout.trim()) as { version: string };
      expect(parsed).toHaveProperty("version");
      expect(typeof parsed.version).toBe("string");
      expect(parsed.version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe("no args", () => {
    it("shows help text and exits with code 0", async () => {
      const { stdout } = await execFileAsync("node", [binPath]);
      expect(stdout).toContain("taskless");
      expect(stdout).toContain("info");
    });
  });
});
