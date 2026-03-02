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

  it("errors when .taskless/taskless.json is missing", async () => {
    const { stderr, exitCode } = await runCli([
      "check",
      "-d",
      temporaryDirectory,
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("taskless.json not found");
  });

  it("warns and exits 0 when rules directory is empty", async () => {
    // Create .taskless with taskless.json but empty rules
    await mkdir(join(temporaryDirectory, ".taskless", "rules"), {
      recursive: true,
    });
    await writeFile(
      join(temporaryDirectory, ".taskless", "taskless.json"),
      JSON.stringify({ version: "2026-03-01" })
    );

    const { stderr, exitCode } = await runCli([
      "check",
      "-d",
      temporaryDirectory,
    ]);
    expect(exitCode).toBe(0);
    expect(stderr).toContain("No rules found");
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

  it("produces JSONL output with --json flag", async () => {
    await cp(fixturesDirectory, temporaryDirectory, { recursive: true });

    const { stdout, exitCode } = await runCli([
      "check",
      "-d",
      temporaryDirectory,
      "--json",
    ]);
    expect(exitCode).toBe(1);

    const lines = stdout
      .trim()
      .split("\n")
      .filter((l) => l.trim() !== "");
    expect(lines.length).toBeGreaterThan(0);

    for (const line of lines) {
      const parsed = JSON.parse(line) as {
        source: string;
        ruleId: string;
        severity: string;
      };
      expect(parsed).toHaveProperty("source", "ast-grep");
      expect(parsed).toHaveProperty("ruleId");
      expect(parsed).toHaveProperty("severity");
      expect(parsed).toHaveProperty("message");
      expect(parsed).toHaveProperty("file");
      expect(parsed).toHaveProperty("range");
      expect(parsed).toHaveProperty("matchedText");
    }
  });

  it("exits 0 for warnings-only, exits 1 for errors", async () => {
    // Create a project with only a warning-level rule
    await mkdir(join(temporaryDirectory, ".taskless", "rules"), {
      recursive: true,
    });
    await writeFile(
      join(temporaryDirectory, ".taskless", "taskless.json"),
      JSON.stringify({ version: "2026-03-01" })
    );
    await writeFile(
      join(temporaryDirectory, ".taskless", "sgconfig.yml"),
      "ruleDirs:\n  - rules\n"
    );
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

  it("accepts versions within a compatibility range", async () => {
    // 2026-02-25 falls between 2026-02-18 and 2026-03-01 — should be supported
    await mkdir(join(temporaryDirectory, ".taskless", "rules"), {
      recursive: true,
    });
    await writeFile(
      join(temporaryDirectory, ".taskless", "taskless.json"),
      JSON.stringify({ version: "2026-02-25" })
    );

    const { stderr, exitCode } = await runCli([
      "check",
      "-d",
      temporaryDirectory,
    ]);
    expect(exitCode).toBe(0);
    expect(stderr).toContain("No rules found");
    expect(stderr).not.toContain("not supported");
  });

  it("errors for versions before earliest supported range", async () => {
    await mkdir(join(temporaryDirectory, ".taskless"), { recursive: true });
    await writeFile(
      join(temporaryDirectory, ".taskless", "taskless.json"),
      JSON.stringify({ version: "2026-02-17" })
    );

    const { stderr, exitCode } = await runCli([
      "check",
      "-d",
      temporaryDirectory,
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("not supported");
  });

  it("errors when version field is missing from taskless.json", async () => {
    await mkdir(join(temporaryDirectory, ".taskless"), { recursive: true });
    await writeFile(
      join(temporaryDirectory, ".taskless", "taskless.json"),
      JSON.stringify({})
    );

    const { stderr, exitCode } = await runCli([
      "check",
      "-d",
      temporaryDirectory,
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("missing");
  });
});
