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
