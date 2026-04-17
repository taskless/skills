import chalk from "chalk";

declare const __VERSION__: string;
const CLI_VERSION: string =
  typeof __VERSION__ === "string" ? __VERSION__ : "unknown";

/**
 * Chalk v5's auto-detection runs at import time. When the CLI is bundled via
 * Vite (no TTY at build time), it gets baked in as `level: 0`, which silently
 * strips every color. Re-detect at runtime and overwrite chalk.level so the
 * bundled binary picks up the terminal's actual capabilities.
 */
function detectColorLevel(): 0 | 1 | 2 | 3 {
  if (process.env.NO_COLOR) return 0;
  const force = process.env.FORCE_COLOR;
  if (force === "0") return 0;
  if (force === "1") return 1;
  if (force === "2") return 2;
  if (force === "3") return 3;
  const isTTY = process.stdout.isTTY === true || process.stderr.isTTY === true;
  if (!isTTY) return 0;
  const term = process.env.TERM ?? "";
  const colorterm = process.env.COLORTERM ?? "";
  if (colorterm === "truecolor" || colorterm === "24bit") return 3;
  if (/-256(color)?$/i.test(term)) return 2;
  if (term === "" || term === "dumb") return 0;
  return 1;
}

chalk.level = detectColorLevel();

/**
 * The Taskless wordmark rendered as 60×5 quad-block ASCII. Produced offline
 * from tmp/logo-dark-on-white.png via tmp/ascii-tool/convert.mjs; see
 * design.md "Intro banner" for rationale. The string is colorless — callers
 * apply color at render time so NO_COLOR works naturally.
 */
const BANNER = `
██████████
▄▄▄▄   ▗▄▄  ▗▄█▙▄▖ ▗▄▄▖   ▄▄▄ ▐█  ▄▖ ▀▀█    ▄▄▖   ▄▄▄   ▄▄▄
██▛▘▗▟████  ▝▀█▛▀▘ ▀ ▝█▖ █▙ ▝▘▐█▗▟▀    █  ▗█▘ ▜▙ █▙ ▝▘ █▙ ▝▘
█▛ ▗██████    █▌  ▐█▀▀█▌  ▀▀▜▙▐█▀▜▙    █  ▐█▀▀▀▀  ▀▀▜▙  ▀▀▜▙
█▘ ███████    ▀▀▀▘▝▀▀▀▀▀ ▀▀▀▀▘▝▀  ▀▘ ▀▀▀▀▀ ▝▀▀▀▘ ▀▀▀▀▘ ▀▀▀▀▘
`.trim();

/**
 * Return the wizard banner styled for the terminal. Honors NO_COLOR and
 * non-TTY contexts via chalk's built-in detection.
 */
export function renderIntro(): string {
  // Direct hex instead of chalk.dim(chalk.cyan(…)): the composed form
  // emits reset codes at each newline and the reapplication flashes
  // brighter on some quadrant chars. A single truecolor attribute
  // stays flat across the whole banner.
  const coloredBanner = chalk.hex("#2B7384")(BANNER);
  const version = chalk.dim(`v${CLI_VERSION}`);
  return `${coloredBanner}\n${version}`;
}

export function getCliVersion(): string {
  return CLI_VERSION;
}
