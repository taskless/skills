import { mkdtemp, rm, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { generateSgConfig } from "../src/rules/sgconfig";
import { ensureTasklessGitignore } from "../src/rules/gitignore";

describe("generateSgConfig", () => {
  let temporaryDirectory: string;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "taskless-sgconfig-"));
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it("writes sgconfig.yml with correct ruleDirs", async () => {
    await generateSgConfig(temporaryDirectory);

    const content = await readFile(
      join(temporaryDirectory, ".taskless", "sgconfig.yml"),
      "utf8"
    );
    expect(content).toContain("ruleDirs:");
    expect(content).toContain("- rules");
    expect(content).toContain("testConfigs:");
    expect(content).toContain("rule-tests");
  });

  it("creates .taskless/.gitignore with required entries", async () => {
    await generateSgConfig(temporaryDirectory);

    const gitignore = await readFile(
      join(temporaryDirectory, ".taskless", ".gitignore"),
      "utf8"
    );
    expect(gitignore).toContain(".env.local.json");
    expect(gitignore).toContain("sgconfig.yml");
  });

  it("is idempotent — running twice does not duplicate gitignore entries", async () => {
    await generateSgConfig(temporaryDirectory);
    await generateSgConfig(temporaryDirectory);

    const gitignore = await readFile(
      join(temporaryDirectory, ".taskless", ".gitignore"),
      "utf8"
    );
    const envCount = gitignore
      .split("\n")
      .filter((line) => line.trim() === ".env.local.json").length;
    expect(envCount).toBe(1);
  });
});

describe("ensureTasklessGitignore", () => {
  let temporaryDirectory: string;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "taskless-gitignore-"));
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it("creates .taskless/.gitignore when .taskless/ does not exist", async () => {
    await ensureTasklessGitignore(temporaryDirectory);

    const content = await readFile(
      join(temporaryDirectory, ".taskless", ".gitignore"),
      "utf8"
    );
    expect(content).toContain(".env.local.json");
    expect(content).toContain("sgconfig.yml");
  });

  it("preserves existing entries and appends missing ones", async () => {
    await mkdir(join(temporaryDirectory, ".taskless"), { recursive: true });
    const existingContent = "custom-file.txt\n.env.local.json\n";
    await import("node:fs/promises").then((fs) =>
      fs.writeFile(
        join(temporaryDirectory, ".taskless", ".gitignore"),
        existingContent,
        "utf8"
      )
    );

    await ensureTasklessGitignore(temporaryDirectory);

    const content = await readFile(
      join(temporaryDirectory, ".taskless", ".gitignore"),
      "utf8"
    );
    expect(content).toContain("custom-file.txt");
    expect(content).toContain(".env.local.json");
    expect(content).toContain("sgconfig.yml");
    // .env.local.json should not be duplicated
    const envCount = content
      .split("\n")
      .filter((line) => line.trim() === ".env.local.json").length;
    expect(envCount).toBe(1);
  });
});
