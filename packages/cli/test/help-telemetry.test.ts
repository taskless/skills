import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spy on telemetry by mocking the module the help command imports. The factory
// is invoked lazily at import time (same pattern as telemetry.test.ts).
const capture = vi.fn();
vi.mock("../src/telemetry", () => ({
  getTelemetry: vi.fn(() =>
    Promise.resolve({ capture, shutdown: () => Promise.resolve() })
  ),
  shutdownTelemetry: () => Promise.resolve(),
}));

const { createHelpCommand } = await import("../src/commands/help");

interface RunnableCommand {
  run: (context: {
    args: { dir: string; anonymous: boolean };
    rawArgs: string[];
  }) => Promise<void>;
}

async function runHelp(rawArguments: string[]): Promise<void> {
  const command = createHelpCommand({}) as unknown as RunnableCommand;
  await command.run({
    args: { dir: process.cwd(), anonymous: false },
    rawArgs: rawArguments,
  });
}

describe("help emits cli_help { topic }", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    capture.mockClear();
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("captures the served topic and no legacy help_* event", async () => {
    await runHelp(["help", "rule", "create"]);
    expect(capture).toHaveBeenCalledWith("cli_help", { topic: "rule create" });

    const events = capture.mock.calls.map((call) => call[0] as string);
    expect(events.every((event) => !event.startsWith("help_"))).toBe(true);
  });

  it("captures the index marker for no topic and no legacy help_index event", async () => {
    await runHelp(["help"]);
    expect(capture).toHaveBeenCalledWith("cli_help", { topic: "(index)" });

    const events = capture.mock.calls.map((call) => call[0] as string);
    expect(events).not.toContain("help_index");
    expect(events.every((event) => !event.startsWith("help_"))).toBe(true);
  });

  it("captures the attempted topic for an unknown topic, and no legacy help_* event", async () => {
    await runHelp(["help", "nope"]);
    expect(capture).toHaveBeenCalledWith("cli_help", { topic: "nope" });

    const events = capture.mock.calls.map((call) => call[0] as string);
    expect(events).not.toContain("help_index");
    expect(events).not.toContain("help_unknown");
    expect(events.every((event) => !event.startsWith("help_"))).toBe(true);
  });
});
