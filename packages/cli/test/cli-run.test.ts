import { describe, expect, it, vi } from "vitest";

import { emitRunEvents, resolveCommandName } from "../src/telemetry-run";
import { CliError } from "../src/util/cli-error";

describe("resolveCommandName", () => {
  it.each([
    [["info"], "info"],
    [["check", "--json"], "check"],
    [["rule", "create"], "rule create"],
    [["rule"], "rule"],
    [["help", "route"], "help"],
    [["-d", "/tmp", "check"], "check"],
    [["--dir", "/tmp", "info"], "info"],
    [[], "(default)"],
  ])("resolves %j to %s", (argv, expected) => {
    expect(resolveCommandName(argv)).toBe(expected);
  });
});

function fakeTelemetry(anonymous = true) {
  return {
    capture: vi.fn(),
    identity: { anonymous },
  };
}

describe("emitRunEvents", () => {
  it("emits exactly one cli_run on success, with no cli_error", () => {
    const telemetry = fakeTelemetry();
    emitRunEvents(telemetry, { command: "info", success: true, durationMs: 5 });

    expect(telemetry.capture).toHaveBeenCalledTimes(1);
    expect(telemetry.capture).toHaveBeenCalledWith(
      "cli_run",
      expect.objectContaining({
        command: "info",
        success: true,
        durationMs: 5,
        anonymous: true,
        loggedIn: false,
      })
    );
  });

  it("emits cli_error (with the CliError code) then cli_run on failure", () => {
    const telemetry = fakeTelemetry();
    emitRunEvents(telemetry, {
      command: "rule create",
      success: false,
      durationMs: 9,
      error: new CliError("nope", "AUTH_REQUIRED"),
    });

    expect(telemetry.capture).toHaveBeenCalledWith("cli_error", {
      command: "rule create",
      code: "AUTH_REQUIRED",
    });
    expect(telemetry.capture).toHaveBeenCalledWith(
      "cli_run",
      expect.objectContaining({ command: "rule create", success: false })
    );
  });

  it("falls back to INTERNAL_ERROR for non-CliError failures", () => {
    const telemetry = fakeTelemetry();
    emitRunEvents(telemetry, {
      command: "info",
      success: false,
      durationMs: 1,
      error: new Error("boom"),
    });

    expect(telemetry.capture).toHaveBeenCalledWith("cli_error", {
      command: "info",
      code: "INTERNAL_ERROR",
    });
  });

  it("reflects an authenticated identity as loggedIn", () => {
    const telemetry = fakeTelemetry(false);
    emitRunEvents(telemetry, { command: "info", success: true, durationMs: 2 });

    expect(telemetry.capture).toHaveBeenCalledWith(
      "cli_run",
      expect.objectContaining({ anonymous: false, loggedIn: true })
    );
  });
});
