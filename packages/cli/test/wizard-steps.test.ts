import { describe, expect, it, vi } from "vitest";

const fakeCancelSymbol = Symbol("cancel");

vi.mock("@clack/prompts", () => ({
  isCancel: (value: unknown) => value === fakeCancelSymbol,
}));

describe("ask wrapper", () => {
  it("returns the prompt's resolved value", async () => {
    const { ask } = await import("../src/wizard/ask");
    const value = await ask("locations", () => Promise.resolve(".claude"));
    expect(value).toBe(".claude");
  });

  it("throws WizardCancelled when the prompt returns a cancel symbol", async () => {
    const { ask, WizardCancelled } = await import("../src/wizard/ask");
    await expect(
      ask("locations", () => Promise.resolve(fakeCancelSymbol))
    ).rejects.toBeInstanceOf(WizardCancelled);
  });

  it("the thrown error carries the step name", async () => {
    const { ask, WizardCancelled } = await import("../src/wizard/ask");
    try {
      await ask("auth", () => Promise.resolve(fakeCancelSymbol));
      expect.fail("expected WizardCancelled");
    } catch (error) {
      expect(error).toBeInstanceOf(WizardCancelled);
      expect((error as InstanceType<typeof WizardCancelled>).step).toBe("auth");
    }
  });
});

describe("locationChoices", () => {
  it("offers every shim target and never the canonical .taskless store", async () => {
    const { locationChoices } = await import("../src/wizard/steps/locations");
    const values = locationChoices([]).options.map((o) => o.value);
    expect(values).toEqual([".claude", ".cursor", ".opencode", ".agents"]);
    expect(values).not.toContain(".taskless");
  });

  it("pre-checks .agents/ when no tools are detected", async () => {
    const { locationChoices } = await import("../src/wizard/steps/locations");
    expect(locationChoices([]).initialValues).toEqual([".agents"]);
  });

  it("pre-checks a detected tool and hints it as detected", async () => {
    const { locationChoices } = await import("../src/wizard/steps/locations");
    const { TOOLS } = await import("../src/install/install");
    const claude = TOOLS.find((t) => t.name === "Claude Code")!;

    const { options, initialValues } = locationChoices([claude]);
    expect(initialValues).toEqual([".claude"]);
    expect(options.find((o) => o.value === ".claude")?.hint).toBe("detected");
    expect(options.find((o) => o.value === ".cursor")?.hint).toBe(
      "not detected"
    );
  });

  it("pre-checks every detected tool's directory", async () => {
    const { locationChoices } = await import("../src/wizard/steps/locations");
    const { TOOLS } = await import("../src/install/install");
    const claude = TOOLS.find((t) => t.name === "Claude Code")!;
    const codex = TOOLS.find((t) => t.name === "Codex")!;

    const { initialValues } = locationChoices([claude, codex]);
    expect(initialValues).toContain(".claude");
    expect(initialValues).toContain(".agents");
  });
});
