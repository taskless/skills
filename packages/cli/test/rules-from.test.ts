import { execFile } from "node:child_process";
import { writeFile, mkdtemp, rm, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { describe, expect, it, beforeEach, afterEach } from "vitest";

const execFileAsync = promisify(execFile);
const binPath = resolve(import.meta.dirname, "../dist/index.js");

describe("rules create --from", () => {
  let temporaryDirectory: string;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "taskless-test-"));
    // Create a minimal .taskless/taskless.json so readProjectConfig succeeds
    await mkdir(join(temporaryDirectory, ".taskless"), { recursive: true });
    await writeFile(
      join(temporaryDirectory, ".taskless", "taskless.json"),
      JSON.stringify({
        version: "2026-03-03",
        orgId: 123,
        repositoryUrl: "https://github.com/test/test",
      })
    );
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it("errors when --from is not provided", async () => {
    try {
      await execFileAsync("node", [
        binPath,
        "rules",
        "create",
        "-d",
        temporaryDirectory,
      ]);
      expect.fail("should have exited with non-zero code");
    } catch (error) {
      const execError = error as { stderr: string; code: number };
      expect(execError.stderr || execError.code).toBeTruthy();
    }
  });

  it("errors when --from file does not exist", async () => {
    try {
      await execFileAsync("node", [
        binPath,
        "rules",
        "create",
        "--from",
        "nonexistent.json",
        "-d",
        temporaryDirectory,
      ]);
      expect.fail("should have exited with non-zero code");
    } catch (error) {
      const execError = error as { stderr: string };
      expect(execError.stderr).toContain("Could not read file");
    }
  });

  it("errors when --from file contains invalid JSON", async () => {
    const badFile = join(temporaryDirectory, "bad.json");
    await writeFile(badFile, "not json at all");

    try {
      await execFileAsync("node", [
        binPath,
        "rules",
        "create",
        "--from",
        badFile,
        "-d",
        temporaryDirectory,
      ]);
      expect.fail("should have exited with non-zero code");
    } catch (error) {
      const execError = error as { stderr: string };
      expect(execError.stderr).toContain("not valid JSON");
    }
  });

  it("errors when --from file is missing the prompt field", async () => {
    const noPromptFile = join(temporaryDirectory, "no-prompt.json");
    await writeFile(noPromptFile, JSON.stringify({ language: "typescript" }));

    try {
      await execFileAsync("node", [
        binPath,
        "rules",
        "create",
        "--from",
        noPromptFile,
        "-d",
        temporaryDirectory,
      ]);
      expect.fail("should have exited with non-zero code");
    } catch (error) {
      const execError = error as { stderr: string };
      expect(execError.stderr).toContain("Invalid input");
    }
  });
});
