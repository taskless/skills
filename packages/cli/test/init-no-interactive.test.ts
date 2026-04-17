import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const binPath = resolve(import.meta.dirname, "../dist/index.js");

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe("taskless init --no-interactive", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "taskless-init-noi-"));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("installs mandatory skills to detected tools without any prompt", async () => {
    await mkdir(join(cwd, ".claude"), { recursive: true });

    const { stdout } = await execFileAsync("node", [
      binPath,
      "init",
      "--no-interactive",
      "-d",
      cwd,
    ]);

    expect(stdout).toContain("Claude Code: installed");

    // Mandatory skill present
    expect(
      await exists(join(cwd, ".claude", "skills", "taskless-check", "SKILL.md"))
    ).toBe(true);
  });

  it("does NOT install optional skills (taskless-ci) in --no-interactive", async () => {
    await mkdir(join(cwd, ".claude"), { recursive: true });

    await execFileAsync("node", [
      binPath,
      "init",
      "--no-interactive",
      "-d",
      cwd,
    ]);

    expect(
      await exists(join(cwd, ".claude", "skills", "taskless-ci", "SKILL.md"))
    ).toBe(false);
  });

  it("falls back to .agents/ when no tools are detected", async () => {
    const { stdout } = await execFileAsync("node", [
      binPath,
      "init",
      "--no-interactive",
      "-d",
      cwd,
    ]);

    expect(stdout).toContain("No tools detected. Using fallback: .agents/");
    expect(
      await exists(join(cwd, ".agents", "skills", "taskless-check", "SKILL.md"))
    ).toBe(true);
  });

  it("does not prompt for authentication (no device code URL printed)", async () => {
    await mkdir(join(cwd, ".claude"), { recursive: true });

    const { stdout, stderr } = await execFileAsync("node", [
      binPath,
      "init",
      "--no-interactive",
      "-d",
      cwd,
    ]);

    const combined = stdout + stderr;
    expect(combined).not.toContain("Log in to taskless.io");
    expect(combined).not.toContain("Open this URL in your browser");
    expect(combined).not.toContain("Enter code:");
  });

  it("auto-detects non-interactive context when no TTY and no flag", async () => {
    // Invoking via execFile makes stdout not-a-TTY, which should trigger
    // the auto-switch notice.
    await mkdir(join(cwd, ".claude"), { recursive: true });

    const { stdout, stderr } = await execFileAsync("node", [
      binPath,
      "init",
      "-d",
      cwd,
    ]);

    expect(stderr).toContain("Detected non-interactive context");
    expect(stdout).toContain("Claude Code: installed");
  });

  it("writes taskless.json with install state recorded", async () => {
    await mkdir(join(cwd, ".claude"), { recursive: true });

    await execFileAsync("node", [
      binPath,
      "init",
      "--no-interactive",
      "-d",
      cwd,
    ]);

    const manifest = JSON.parse(
      await readFile(join(cwd, ".taskless", "taskless.json"), "utf8")
    ) as { version: number; install: Record<string, unknown> };

    expect(manifest.version).toBe(2);
    expect(manifest.install).toBeDefined();
  });
});
