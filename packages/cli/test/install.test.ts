import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  applyInstallPlan,
  buildInstallPlan,
  checkStaleness,
  detectSelectedDirectories,
  detectTools,
  getEmbeddedCommands,
  getEmbeddedSkills,
} from "../src/install/install";

let cwd: string;

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "taskless-install-test-"));
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

describe("detectTools", () => {
  it("detects Claude Code via .claude/ directory", async () => {
    await mkdir(join(cwd, ".claude"), { recursive: true });
    const tools = await detectTools(cwd);
    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe("Claude Code");
  });

  it("detects Claude Code via CLAUDE.md file", async () => {
    await writeFile(join(cwd, "CLAUDE.md"), "# Claude", "utf8");
    const tools = await detectTools(cwd);
    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe("Claude Code");
  });

  it("detects OpenCode via .opencode/ directory", async () => {
    await mkdir(join(cwd, ".opencode"), { recursive: true });
    const tools = await detectTools(cwd);
    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe("OpenCode");
  });

  it("detects OpenCode via opencode.jsonc file", async () => {
    await writeFile(join(cwd, "opencode.jsonc"), "{}", "utf8");
    const tools = await detectTools(cwd);
    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe("OpenCode");
  });

  it("detects OpenCode via opencode.json file", async () => {
    await writeFile(join(cwd, "opencode.json"), "{}", "utf8");
    const tools = await detectTools(cwd);
    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe("OpenCode");
  });

  it("detects Cursor via .cursor/ directory", async () => {
    await mkdir(join(cwd, ".cursor"), { recursive: true });
    const tools = await detectTools(cwd);
    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe("Cursor");
  });

  it("detects Cursor via .cursorrules file", async () => {
    await writeFile(join(cwd, ".cursorrules"), "", "utf8");
    const tools = await detectTools(cwd);
    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe("Cursor");
  });

  it("returns multiple tools when multiple signals exist", async () => {
    await mkdir(join(cwd, ".claude"), { recursive: true });
    await mkdir(join(cwd, ".cursor"), { recursive: true });
    const tools = await detectTools(cwd);
    expect(tools).toHaveLength(2);
    const names = tools.map((t) => t.name);
    expect(names).toContain("Claude Code");
    expect(names).toContain("Cursor");
  });

  it("detects Codex via .codex/ directory", async () => {
    await mkdir(join(cwd, ".codex"), { recursive: true });
    const tools = await detectTools(cwd);
    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe("Codex");
    expect(tools[0]!.installDir).toBe(".agents");
  });

  it("returns Codex once when multiple Codex signals match", async () => {
    await mkdir(join(cwd, ".codex"), { recursive: true });
    await writeFile(join(cwd, ".codex", "config.toml"), "", "utf8");
    const tools = await detectTools(cwd);
    expect(tools.filter((t) => t.name === "Codex")).toHaveLength(1);
  });

  it("returns empty when no signals match", async () => {
    const tools = await detectTools(cwd);
    expect(tools).toHaveLength(0);
  });
});

describe("detectSelectedDirectories", () => {
  it("defaults to .agents when no tools are detected", async () => {
    expect(await detectSelectedDirectories(cwd)).toEqual([".agents"]);
  });

  it("returns the install dir of a detected tool", async () => {
    await mkdir(join(cwd, ".claude"), { recursive: true });
    expect(await detectSelectedDirectories(cwd)).toEqual([".claude"]);
  });

  it("returns every detected tool's directory in catalog order", async () => {
    await mkdir(join(cwd, ".cursor"), { recursive: true });
    await mkdir(join(cwd, ".claude"), { recursive: true });
    expect(await detectSelectedDirectories(cwd)).toEqual([
      ".claude",
      ".cursor",
    ]);
  });

  it("maps Codex detection to .agents", async () => {
    await mkdir(join(cwd, ".codex"), { recursive: true });
    expect(await detectSelectedDirectories(cwd)).toEqual([".agents"]);
  });
});

describe("checkStaleness", () => {
  it("reports a detected tool as up to date after install", async () => {
    await mkdir(join(cwd, ".claude"), { recursive: true });
    const plan = buildInstallPlan(
      [".claude"],
      getEmbeddedSkills(),
      getEmbeddedCommands()
    );
    await applyInstallPlan(cwd, plan, { cliVersion: "0.7.0" });

    const statuses = await checkStaleness(cwd);
    expect(statuses).toHaveLength(1);
    expect(statuses[0]!.name).toBe("Claude Code");
    expect(statuses[0]!.skills.length).toBeGreaterThan(0);
    for (const skill of statuses[0]!.skills) {
      expect(skill.current).toBe(true);
    }
  });

  it("reports a skill as stale when the canonical store is missing", async () => {
    await mkdir(join(cwd, ".claude"), { recursive: true });
    const statuses = await checkStaleness(cwd);
    expect(statuses).toHaveLength(1);
    for (const skill of statuses[0]!.skills) {
      expect(skill.current).toBe(false);
      expect(skill.installedVersion).toBeUndefined();
    }
  });
});
