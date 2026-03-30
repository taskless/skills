import { execFile } from "node:child_process";
import { readFile, mkdtemp, rm, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { describe, expect, it, beforeEach, afterEach } from "vitest";

const execFileAsync = promisify(execFile);
const binPath = resolve(import.meta.dirname, "../dist/index.js");

describe("cli", () => {
  it("has a shebang in the built output", async () => {
    const content = await readFile(binPath, "utf8");
    expect(content.startsWith("#!/usr/bin/env node\n")).toBe(true);
  });

  describe("info", () => {
    it("outputs version and tools as JSON", async () => {
      const { stdout } = await execFileAsync("node", [binPath, "info"]);
      const parsed = JSON.parse(stdout.trim()) as {
        version: string;
        tools: unknown[];
      };
      expect(parsed).toHaveProperty("version");
      expect(typeof parsed.version).toBe("string");
      expect(parsed.version).toMatch(/^\d+\.\d+\.\d+/);
      expect(parsed).toHaveProperty("tools");
      expect(Array.isArray(parsed.tools)).toBe(true);
    });
  });

  describe("no args", () => {
    it("shows help text and exits with code 0", async () => {
      const { stdout } = await execFileAsync("node", [binPath]);
      expect(stdout).toContain("taskless");
      expect(stdout).toContain("info");
      expect(stdout).toContain("init");
      expect(stdout).not.toContain("update-engine");
    });
  });

  describe("init", () => {
    let temporaryDirectory: string;

    beforeEach(async () => {
      temporaryDirectory = await mkdtemp(join(tmpdir(), "taskless-test-"));
    });

    afterEach(async () => {
      await rm(temporaryDirectory, { recursive: true, force: true });
    });

    it("shows alternative install methods when no tool directories exist", async () => {
      const { stdout } = await execFileAsync("node", [
        binPath,
        "init",
        "-d",
        temporaryDirectory,
      ]);
      expect(stdout).toContain("No supported tool directories detected");
      expect(stdout).toContain("Alternative installation methods");
    });

    it("installs skills when .claude/ directory exists", async () => {
      await mkdir(join(temporaryDirectory, ".claude"), { recursive: true });

      const { stdout } = await execFileAsync("node", [
        binPath,
        "init",
        "-d",
        temporaryDirectory,
      ]);
      expect(stdout).toContain("Claude Code");

      const skillContent = await readFile(
        join(
          temporaryDirectory,
          ".claude",
          "skills",
          "taskless-info",
          "SKILL.md"
        ),
        "utf8"
      );
      expect(skillContent).toContain("name: taskless-info");

      const commandContent = await readFile(
        join(temporaryDirectory, ".claude", "commands", "tskl", "info.md"),
        "utf8"
      );
      expect(commandContent).toContain("Taskless");
    });

    it("reports staleness via info after install", async () => {
      await mkdir(join(temporaryDirectory, ".claude"), { recursive: true });

      // Install first
      await execFileAsync("node", [binPath, "init", "-d", temporaryDirectory]);

      // Check info
      const { stdout } = await execFileAsync("node", [
        binPath,
        "info",
        "-d",
        temporaryDirectory,
      ]);
      const parsed = JSON.parse(stdout.trim()) as {
        version: string;
        tools: Array<{
          name: string;
          skills: Array<{ name: string; current: boolean }>;
        }>;
      };

      expect(parsed.tools.length).toBeGreaterThan(0);
      const claudeTool = parsed.tools.find((t) => t.name === "Claude Code");
      expect(claudeTool).toBeDefined();
      expect(claudeTool!.skills[0]!.current).toBe(true);
    });
  });
});
