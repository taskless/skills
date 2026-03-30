import { execFile } from "node:child_process";
import { mkdtemp, rm, mkdir, writeFile, cp } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { describe, expect, it, beforeEach, afterEach } from "vitest";

const execFileAsync = promisify(execFile);
const binPath = resolve(import.meta.dirname, "../dist/index.js");
const fixturesDirectory = resolve(
  import.meta.dirname,
  "fixtures/taskless-project"
);

/** Run the CLI and capture output, allowing non-zero exit codes */
async function runCli(
  args: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execFileAsync("node", [binPath, ...args]);
    return { stdout, stderr, exitCode: 0 };
  } catch (error) {
    const execError = error as {
      stdout: string;
      stderr: string;
      code: number;
    };
    return {
      stdout: execError.stdout ?? "",
      stderr: execError.stderr ?? "",
      exitCode: execError.code,
    };
  }
}

describe("check", () => {
  let temporaryDirectory: string;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "taskless-check-"));
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it("exits 0 with friendly message when .taskless/ does not exist", async () => {
    const { stdout, exitCode } = await runCli([
      "check",
      "-d",
      temporaryDirectory,
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("No rules configured");
  });

  it("exits 0 with friendly message when rules directory is empty", async () => {
    await mkdir(join(temporaryDirectory, ".taskless", "rules"), {
      recursive: true,
    });

    const { stdout, exitCode } = await runCli([
      "check",
      "-d",
      temporaryDirectory,
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("No rules configured");
  });

  it("runs scanner and produces human output for rule matches", async () => {
    await cp(fixturesDirectory, temporaryDirectory, { recursive: true });

    const { stdout, exitCode } = await runCli([
      "check",
      "-d",
      temporaryDirectory,
    ]);
    expect(exitCode).toBe(1); // has error-severity match (no-eval)
    expect(stdout).toContain("no-eval");
    expect(stdout).toContain("eval");
    expect(stdout).toContain("error");
    expect(stdout).toContain("issue");
  });

  it("produces JSON output with --json flag", async () => {
    await cp(fixturesDirectory, temporaryDirectory, { recursive: true });

    const { stdout, exitCode } = await runCli([
      "check",
      "-d",
      temporaryDirectory,
      "--json",
    ]);
    expect(exitCode).toBe(1);

    const parsed = JSON.parse(stdout.trim()) as {
      success: boolean;
      results: Array<{
        source: string;
        ruleId: string;
        severity: string;
        message: string;
        file: string;
        range: unknown;
        matchedText: string;
      }>;
    };

    expect(parsed).toHaveProperty("success");
    expect(parsed).toHaveProperty("results");
    expect(parsed.results.length).toBeGreaterThan(0);

    for (const result of parsed.results) {
      expect(result).toHaveProperty("source", "ast-grep");
      expect(result).toHaveProperty("ruleId");
      expect(result).toHaveProperty("severity");
      expect(result).toHaveProperty("message");
      expect(result).toHaveProperty("file");
      expect(result).toHaveProperty("range");
      expect(result).toHaveProperty("matchedText");
    }
  });

  it("exits 0 for warnings-only, exits 1 for errors", async () => {
    // Create a project with only a warning-level rule
    await mkdir(join(temporaryDirectory, ".taskless", "rules"), {
      recursive: true,
    });
    await writeFile(
      join(temporaryDirectory, ".taskless", "rules", "warn-only.yml"),
      [
        "id: no-console-warn",
        "language: javascript",
        "severity: warning",
        "rule:",
        "  pattern: console.warn($$$)",
        "message: Avoid console.warn",
      ].join("\n")
    );
    await writeFile(
      join(temporaryDirectory, "test.js"),
      'console.warn("hello");\n'
    );

    const { exitCode } = await runCli(["check", "-d", temporaryDirectory]);
    expect(exitCode).toBe(0); // warnings only → exit 0
  });

  it("does not require taskless.json to run", async () => {
    await cp(fixturesDirectory, temporaryDirectory, { recursive: true });
    // Remove taskless.json if it exists — check should still work with just rules
    await rm(join(temporaryDirectory, ".taskless", "taskless.json"), {
      force: true,
    });

    const { stdout, exitCode } = await runCli([
      "check",
      "-d",
      temporaryDirectory,
    ]);
    expect(exitCode).toBe(1); // has error-severity match (no-eval)
    expect(stdout).toContain("no-eval");
  });
});
