import { mkdir, mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AGENTS_FALLBACK,
  detectTools,
  getEmbeddedSkills,
  installForTool,
  checkStaleness,
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

  it("returns empty when no signals match", async () => {
    const tools = await detectTools(cwd);
    expect(tools).toHaveLength(0);
  });
});

describe("installForTool", () => {
  it("writes skills to installDir-based path", async () => {
    const skills = getEmbeddedSkills();
    const tool = {
      name: "Test Tool",
      detect: [{ type: "directory" as const, path: ".test" }],
      installDir: ".test",
      skills: { path: "skills" },
    };

    const result = await installForTool(cwd, tool, skills, []);
    expect(result.skills.length).toBeGreaterThan(0);

    const firstSkill = result.skills[0]!;
    const content = await readFile(
      join(cwd, ".test", "skills", firstSkill, "SKILL.md"),
      "utf8"
    );
    expect(content).toBeTruthy();
  });

  it("creates directories if installDir does not exist", async () => {
    const tool = {
      name: "Test Tool",
      detect: [{ type: "file" as const, path: "TEST.md" }],
      installDir: ".nonexistent",
      skills: { path: "skills" },
    };
    const skills = getEmbeddedSkills();

    const result = await installForTool(cwd, tool, skills, []);
    expect(result.skills.length).toBeGreaterThan(0);

    const firstSkill = result.skills[0]!;
    const content = await readFile(
      join(cwd, ".nonexistent", "skills", firstSkill, "SKILL.md"),
      "utf8"
    );
    expect(content).toBeTruthy();
  });
});

describe("AGENTS_FALLBACK", () => {
  it("installs skills to .agents/skills/ when no tools detected", async () => {
    const tools = await detectTools(cwd);
    expect(tools).toHaveLength(0);

    const skills = getEmbeddedSkills();
    const result = await installForTool(cwd, AGENTS_FALLBACK, skills, []);
    expect(result.skills.length).toBeGreaterThan(0);

    const firstSkill = result.skills[0]!;
    const content = await readFile(
      join(cwd, ".agents", "skills", firstSkill, "SKILL.md"),
      "utf8"
    );
    expect(content).toBeTruthy();
  });

  it("is not used when at least one tool is detected", async () => {
    await mkdir(join(cwd, ".claude"), { recursive: true });
    const tools = await detectTools(cwd);
    expect(tools.length).toBeGreaterThan(0);
    // Fallback should not be in the detected tools
    expect(tools.every((t) => t.name !== AGENTS_FALLBACK.name)).toBe(true);
  });

  it("does not install commands", async () => {
    const skills = getEmbeddedSkills();
    const result = await installForTool(cwd, AGENTS_FALLBACK, skills, []);
    expect(result.commands).toHaveLength(0);
  });
});

describe("checkStaleness", () => {
  it("reports status using installDir-based paths", async () => {
    await mkdir(join(cwd, ".claude"), { recursive: true });

    const skills = getEmbeddedSkills();
    const tools = await detectTools(cwd);
    expect(tools).toHaveLength(1);

    await installForTool(cwd, tools[0]!, skills, []);

    const statuses = await checkStaleness(cwd);
    expect(statuses).toHaveLength(1);
    expect(statuses[0]!.name).toBe("Claude Code");
    expect(statuses[0]!.skills.length).toBeGreaterThan(0);

    for (const skill of statuses[0]!.skills) {
      expect(skill.current).toBe(true);
    }
  });

  it("reports status for multiple detected tools", async () => {
    await mkdir(join(cwd, ".claude"), { recursive: true });
    await mkdir(join(cwd, ".cursor"), { recursive: true });

    const skills = getEmbeddedSkills();
    const tools = await detectTools(cwd);
    expect(tools).toHaveLength(2);

    for (const tool of tools) {
      await installForTool(cwd, tool, skills, []);
    }

    const statuses = await checkStaleness(cwd);
    expect(statuses).toHaveLength(2);
    const names = statuses.map((s) => s.name);
    expect(names).toContain("Claude Code");
    expect(names).toContain("Cursor");

    for (const status of statuses) {
      for (const skill of status.skills) {
        expect(skill.current).toBe(true);
      }
    }
  });
});
