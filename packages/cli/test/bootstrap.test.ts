import {
  mkdtemp,
  rm,
  readFile,
  writeFile,
  mkdir,
  stat,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { ensureTasklessDirectory } from "../src/rules/bootstrap";

describe("ensureTasklessDirectory", () => {
  let temporaryDirectory: string;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "taskless-bootstrap-"));
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it("creates .taskless/ with all standard files on first run", async () => {
    await ensureTasklessDirectory(temporaryDirectory);

    const tasklessDirectory = join(temporaryDirectory, ".taskless");

    // taskless.json exists with version
    const manifest = JSON.parse(
      await readFile(join(tasklessDirectory, "taskless.json"), "utf8")
    ) as { version: number };
    expect(manifest.version).toBeGreaterThan(0);

    // README.md exists
    const readme = await readFile(join(tasklessDirectory, "README.md"), "utf8");
    expect(readme).toContain("Taskless");
    expect(readme).toContain("taskless.io");

    // .gitignore has required entries
    const gitignore = await readFile(
      join(tasklessDirectory, ".gitignore"),
      "utf8"
    );
    expect(gitignore).toContain(".env.local.json");
    expect(gitignore).toContain("sgconfig.yml");

    // Subdirectories exist
    const rulesStat = await stat(join(tasklessDirectory, "rules"));
    expect(rulesStat.isDirectory()).toBe(true);
    const testsStat = await stat(join(tasklessDirectory, "rule-tests"));
    expect(testsStat.isDirectory()).toBe(true);
  });

  it("is a no-op when already up-to-date", async () => {
    await ensureTasklessDirectory(temporaryDirectory);

    const tasklessDirectory = join(temporaryDirectory, ".taskless");
    const manifestBefore = await readFile(
      join(tasklessDirectory, "taskless.json"),
      "utf8"
    );
    const readmeBefore = await readFile(
      join(tasklessDirectory, "README.md"),
      "utf8"
    );

    // Run again
    await ensureTasklessDirectory(temporaryDirectory);

    const manifestAfter = await readFile(
      join(tasklessDirectory, "taskless.json"),
      "utf8"
    );
    const readmeAfter = await readFile(
      join(tasklessDirectory, "README.md"),
      "utf8"
    );

    expect(manifestAfter).toBe(manifestBefore);
    expect(readmeAfter).toBe(readmeBefore);
  });

  it("runs only new migrations when version is outdated", async () => {
    const tasklessDirectory = join(temporaryDirectory, ".taskless");
    await mkdir(tasklessDirectory, { recursive: true });

    // Write a manifest at version 0 (no migrations run yet)
    await writeFile(
      join(tasklessDirectory, "taskless.json"),
      JSON.stringify({ version: 0 }),
      "utf8"
    );

    await ensureTasklessDirectory(temporaryDirectory);

    // Should have run migrations and updated version
    const manifest = JSON.parse(
      await readFile(join(tasklessDirectory, "taskless.json"), "utf8")
    ) as { version: number };
    expect(manifest.version).toBeGreaterThan(0);

    // Files from 001-init should exist
    const readmeStat = await stat(join(tasklessDirectory, "README.md"));
    expect(readmeStat.isFile()).toBe(true);
    const rulesStat = await stat(join(tasklessDirectory, "rules"));
    expect(rulesStat.isDirectory()).toBe(true);
  });

  it("is idempotent — re-running after completion succeeds without errors", async () => {
    await ensureTasklessDirectory(temporaryDirectory);
    await ensureTasklessDirectory(temporaryDirectory);
    await ensureTasklessDirectory(temporaryDirectory);

    // Should not throw and files should still be intact
    const tasklessDirectory = join(temporaryDirectory, ".taskless");
    const manifest = JSON.parse(
      await readFile(join(tasklessDirectory, "taskless.json"), "utf8")
    ) as { version: number };
    expect(manifest.version).toBeGreaterThan(0);
  });
});
