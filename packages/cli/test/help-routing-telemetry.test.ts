import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// TODO(#39): once the restructure-cli-telemetry change lands on main, the
// per-topic `help_<topic>` events collapse into a single
// `cli_help { topic }`. These assertions then move to `cli_help` with a topic
// property, and the help command stops emitting bespoke per-topic names. This
// half is self-surfacing: against the new help command this suite fails, so the
// rebase can't silently skip it. See the telemetry stack's analytics spec.
//
// Spy on the telemetry capture by mocking the telemetry module the help
// command imports. The factory is invoked lazily at import time, so the
// closure over `capture` resolves after initialization (same pattern as
// telemetry.test.ts mocking posthog-node).
const capture = vi.fn();
vi.mock("../src/telemetry", () => ({
  getTelemetry: vi.fn(() =>
    Promise.resolve({
      capture,
      shutdown: () => Promise.resolve(),
    })
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

describe("help routing topics emit help_<topic> intent telemetry", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    capture.mockClear();
    // Suppress the recipe text the command prints to stdout.
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it.each(["route", "existing", "static", "remote"])(
    "captures help_%s",
    async (topic) => {
      const command = createHelpCommand({}) as unknown as RunnableCommand;
      await command.run({
        args: { dir: process.cwd(), anonymous: false },
        rawArgs: ["help", topic],
      });

      expect(capture).toHaveBeenCalledWith(
        `help_${topic}`,
        expect.objectContaining({ topic })
      );
    }
  );
});
