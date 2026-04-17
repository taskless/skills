import { isCancel } from "@clack/prompts";

/**
 * Tagged error thrown when the user cancels a wizard prompt (Ctrl-C, Esc,
 * or any clack-emitted cancel symbol). The top-level `runWizard()`
 * catches this to abort cleanly without writing any files.
 */
export class WizardCancelled extends Error {
  constructor(public readonly step: string) {
    super(`Wizard cancelled at step: ${step}`);
    this.name = "WizardCancelled";
  }
}

/**
 * Wrap a clack prompt so its cancel signal (a unique Symbol, not an error)
 * is converted into a thrown {@link WizardCancelled}. Every wizard step
 * that calls a clack prompt should pipe the result through this function.
 */
export async function ask<T>(
  step: string,
  promptFunction: () => Promise<T | symbol>
): Promise<T> {
  const result = await promptFunction();
  if (isCancel(result)) {
    throw new WizardCancelled(step);
  }
  return result;
}
