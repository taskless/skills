import { multiselect, log } from "@clack/prompts";

import {
  CANONICAL_DIR,
  DEFAULT_SHIM_DIR,
  SHIM_TARGETS,
  detectTools,
  type ToolDescriptor,
} from "../../install/install";
import { readInstallState } from "../../install/state";
import { ask } from "../ask";

/** A single entry in the tool-selection multiselect. */
export interface LocationChoice {
  value: string;
  label: string;
  hint: string;
}

/**
 * Build the tool-selection multiselect options and the pre-checked set from
 * the detected tools and the install manifest's recorded targets. Pure — no
 * prompt, no TTY, no filesystem access — so the mapping is unit-testable.
 *
 * Every shim target is always offered (a peer list); the canonical
 * `.taskless/` store is never an entry. The pre-checked set is the union of
 * manifest-recorded shim directories and detected tools' directories, so a
 * location Taskless already installed into shows checked and can be
 * unchecked. `.agents/` is pre-checked as the default only when nothing is
 * recorded and nothing is detected.
 *
 * Each entry's hint reflects its origin: `installed` when recorded in the
 * manifest (takes precedence), otherwise `detected` when the tool is present,
 * otherwise `not detected` (the `.agents/` default keeps a descriptive hint).
 *
 * @param manifestDirectories Shim directories recorded in the install
 *   manifest; the canonical `.taskless/` directory is ignored if present.
 */
export function locationChoices(
  detected: ToolDescriptor[],
  manifestDirectories: readonly string[] = []
): {
  options: LocationChoice[];
  initialValues: string[];
} {
  const detectedDirectories = new Set(detected.map((t) => t.installDir));
  const installedDirectories = new Set(
    manifestDirectories.filter((d) => d !== CANONICAL_DIR)
  );

  const preChecked = SHIM_TARGETS.map((s) => s.dir).filter(
    (directory) =>
      installedDirectories.has(directory) || detectedDirectories.has(directory)
  );
  const initialValues = preChecked.length > 0 ? preChecked : [DEFAULT_SHIM_DIR];

  const options = SHIM_TARGETS.map((shim) => ({
    value: shim.dir,
    label: `${shim.label} (${shim.dir}/)`,
    hint: installedDirectories.has(shim.dir)
      ? "installed"
      : detectedDirectories.has(shim.dir)
        ? "detected"
        : shim.dir === DEFAULT_SHIM_DIR
          ? "generic agent skills"
          : "not detected",
  }));

  return { options, initialValues };
}

/**
 * Ask which tools to enable Taskless for. The canonical `.taskless/` store is
 * always written and is not offered here — these choices only control which
 * tool directories receive a reference stub.
 */
export async function promptLocations(cwd: string): Promise<string[]> {
  const detected = await detectTools(cwd);
  const installState = await readInstallState(cwd);
  const manifestDirectories = Object.keys(installState.targets);
  const { options, initialValues } = locationChoices(
    detected,
    manifestDirectories
  );

  while (true) {
    const selected = await ask("locations", () =>
      multiselect<string>({
        message: "Which tools do you want to enable Taskless for?",
        options,
        initialValues,
        required: false,
      })
    );

    if (selected.length === 0) {
      log.error("Select at least one tool.");
      continue;
    }

    return selected;
  }
}
