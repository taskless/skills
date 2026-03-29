import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { describe, expect, it, beforeEach, afterEach } from "vitest";

const execFileAsync = promisify(execFile);
const binPath = resolve(import.meta.dirname, "../dist/index.js");

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

/**
 * Parse the three schema blocks from --schema output.
 * Returns { input, output, error } where each is either a parsed JSON object or a string message.
 */
function parseSchemaOutput(stdout: string): {
  input: Record<string, unknown> | string;
  output: Record<string, unknown>;
  error: Record<string, unknown>;
} {
  const sections = stdout.split(/\n\n/);
  const result: Record<string, unknown> = {};

  for (const section of sections) {
    const lines = section.trim();
    if (lines.startsWith("Input Schema:")) {
      const body = lines.replace("Input Schema:", "").trim();
      try {
        result.input = JSON.parse(body) as Record<string, unknown>;
      } catch {
        result.input = body;
      }
    } else if (lines.startsWith("Output Schema:")) {
      const body = lines.replace("Output Schema:", "").trim();
      result.output = JSON.parse(body) as Record<string, unknown>;
    } else if (lines.startsWith("Error Schema:")) {
      const body = lines.replace("Error Schema:", "").trim();
      result.error = JSON.parse(body) as Record<string, unknown>;
    }
  }

  return result as {
    input: Record<string, unknown> | string;
    output: Record<string, unknown>;
    error: Record<string, unknown>;
  };
}

describe("--schema flag", () => {
  let temporaryDirectory: string;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "taskless-schema-"));
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  describe("rules create --schema", () => {
    it("exits 0 and prints three schema blocks", async () => {
      const { stdout, exitCode } = await runCli([
        "rules",
        "create",
        "--schema",
      ]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Input Schema:");
      expect(stdout).toContain("Output Schema:");
      expect(stdout).toContain("Error Schema:");
    });

    it("has a valid input schema with prompt as required", async () => {
      const { stdout } = await runCli(["rules", "create", "--schema"]);
      const schemas = parseSchemaOutput(stdout);

      expect(typeof schemas.input).toBe("object");
      const input = schemas.input as Record<string, unknown>;
      expect(input.type).toBe("object");

      const properties = input.properties as Record<string, unknown>;
      expect(properties).toHaveProperty("prompt");
      expect(properties).toHaveProperty("successCases");
      expect(properties).toHaveProperty("failureCases");

      const required = input.required as string[];
      expect(required).toContain("prompt");
    });

    it("has a valid output schema with success, ruleId, rules, files", async () => {
      const { stdout } = await runCli(["rules", "create", "--schema"]);
      const schemas = parseSchemaOutput(stdout);

      const output = schemas.output;
      expect(output.type).toBe("object");

      const properties = output.properties as Record<string, unknown>;
      expect(properties).toHaveProperty("success");
      expect(properties).toHaveProperty("ruleId");
      expect(properties).toHaveProperty("rules");
      expect(properties).toHaveProperty("files");
    });

    it("has a valid error schema with error field", async () => {
      const { stdout } = await runCli(["rules", "create", "--schema"]);
      const schemas = parseSchemaOutput(stdout);

      const error = schemas.error;
      expect(error.type).toBe("object");

      const properties = error.properties as Record<string, unknown>;
      expect(properties).toHaveProperty("error");
    });

    it("does not require auth or config", async () => {
      // Run in a directory with no .taskless/ — should still work
      const { exitCode } = await runCli([
        "rules",
        "create",
        "--schema",
        "-d",
        temporaryDirectory,
      ]);
      expect(exitCode).toBe(0);
    });

    it("ignores --from when --schema is passed", async () => {
      const { exitCode, stdout } = await runCli([
        "rules",
        "create",
        "--schema",
        "--from",
        "nonexistent.json",
      ]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Input Schema:");
    });
  });

  describe("rules improve --schema", () => {
    it("exits 0 and prints three schema blocks", async () => {
      const { stdout, exitCode } = await runCli([
        "rules",
        "improve",
        "--schema",
      ]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Input Schema:");
      expect(stdout).toContain("Output Schema:");
      expect(stdout).toContain("Error Schema:");
    });

    it("has input schema requiring ruleId and guidance", async () => {
      const { stdout } = await runCli(["rules", "improve", "--schema"]);
      const schemas = parseSchemaOutput(stdout);

      const input = schemas.input as Record<string, unknown>;
      const properties = input.properties as Record<string, unknown>;
      expect(properties).toHaveProperty("ruleId");
      expect(properties).toHaveProperty("guidance");
      expect(properties).toHaveProperty("references");

      const required = input.required as string[];
      expect(required).toContain("ruleId");
      expect(required).toContain("guidance");
    });
  });

  describe("rules meta --schema", () => {
    it("exits 0 and prints schema blocks", async () => {
      const { stdout, exitCode } = await runCli([
        "rules",
        "meta",
        "dummy-id",
        "--schema",
      ]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Input Schema:");
      expect(stdout).toContain("Output Schema:");
      expect(stdout).toContain("Error Schema:");
    });

    it("has no JSON input schema", async () => {
      const { stdout } = await runCli([
        "rules",
        "meta",
        "dummy-id",
        "--schema",
      ]);
      const schemas = parseSchemaOutput(stdout);

      expect(typeof schemas.input).toBe("string");
      expect(schemas.input).toContain("does not accept JSON input");
    });

    it("has output schema with id, ticketId, generatedAt, schemaVersion", async () => {
      const { stdout } = await runCli([
        "rules",
        "meta",
        "dummy-id",
        "--schema",
      ]);
      const schemas = parseSchemaOutput(stdout);

      const output = schemas.output;
      expect(output.type).toBe("object");

      const properties = output.properties as Record<string, unknown>;
      expect(properties).toHaveProperty("id");
      expect(properties).toHaveProperty("ticketId");
      expect(properties).toHaveProperty("generatedAt");
      expect(properties).toHaveProperty("schemaVersion");
    });

    it("has a valid error schema with error field", async () => {
      const { stdout } = await runCli([
        "rules",
        "meta",
        "dummy-id",
        "--schema",
      ]);
      const schemas = parseSchemaOutput(stdout);

      const error = schemas.error;
      expect(error.type).toBe("object");

      const properties = error.properties as Record<string, unknown>;
      expect(properties).toHaveProperty("error");
    });

    it("does not require auth or config", async () => {
      const { exitCode } = await runCli([
        "rules",
        "meta",
        "dummy-id",
        "--schema",
        "-d",
        temporaryDirectory,
      ]);
      expect(exitCode).toBe(0);
    });
  });

  describe("check --schema", () => {
    it("exits 0 and prints three schema blocks", async () => {
      const { stdout, exitCode } = await runCli(["check", "--schema"]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Input Schema:");
      expect(stdout).toContain("Output Schema:");
      expect(stdout).toContain("Error Schema:");
    });

    it("has no JSON input schema", async () => {
      const { stdout } = await runCli(["check", "--schema"]);
      const schemas = parseSchemaOutput(stdout);

      expect(typeof schemas.input).toBe("string");
      expect(schemas.input).toContain("does not accept JSON input");
    });

    it("has output schema with success and results", async () => {
      const { stdout } = await runCli(["check", "--schema"]);
      const schemas = parseSchemaOutput(stdout);

      const output = schemas.output;
      expect(output.type).toBe("object");

      const properties = output.properties as Record<string, unknown>;
      expect(properties).toHaveProperty("success");
      expect(properties).toHaveProperty("results");
    });

    it("does not require .taskless/ directory", async () => {
      const { exitCode } = await runCli([
        "check",
        "--schema",
        "-d",
        temporaryDirectory,
      ]);
      expect(exitCode).toBe(0);
    });
  });

  describe("update-engine --schema", () => {
    it("exits 0 and prints three schema blocks", async () => {
      const { stdout, exitCode } = await runCli(["update-engine", "--schema"]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Input Schema:");
      expect(stdout).toContain("Output Schema:");
      expect(stdout).toContain("Error Schema:");
    });

    it("has no JSON input schema", async () => {
      const { stdout } = await runCli(["update-engine", "--schema"]);
      const schemas = parseSchemaOutput(stdout);

      expect(typeof schemas.input).toBe("string");
      expect(schemas.input).toContain("does not accept JSON input");
    });

    it("has output schema describing status variants", async () => {
      const { stdout } = await runCli(["update-engine", "--schema"]);
      const schemas = parseSchemaOutput(stdout);

      const output = schemas.output;
      // discriminatedUnion produces anyOf/oneOf
      expect(output.anyOf ?? output.oneOf).toBeDefined();
    });
  });
});
