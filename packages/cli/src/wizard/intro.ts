import pc from "picocolors";

declare const __VERSION__: string;
const CLI_VERSION: string =
  typeof __VERSION__ === "string" ? __VERSION__ : "unknown";

/**
 * The Taskless wordmark rendered as 60×5 half-block ASCII. Produced offline
 * from tmp/logo-dark-on-white.png via tmp/ascii-tool/convert.mjs; see
 * design.md "Intro banner" for rationale. The string is colorless — callers
 * apply color at render time via picocolors so NO_COLOR works naturally.
 */
const BANNER = `██████████
▄▄▄▄    ▄▄  ▄▄█▄▄  ▄▄▄    ▄▄▄  █  ▄▄ ▀▀█    ▄▄    ▄▄▄   ▄▄▄
███  ▄████   ▀█▀▀  ▀ ▀█  ██  ▀ █▄█▀    █   █▀ ██ ██  ▀ ██  ▀
██  ██████    █   ▄█▀▀█   ▀▀▀█ █▀█▄    █   █▀▀▀▀  ▀▀▀█  ▀▀▀█
█  ███████    ▀▀▀▀ ▀▀▀▀▀ ▀▀▀▀▀ ▀  ▀▀ ▀▀▀▀▀ ▀▀▀▀  ▀▀▀▀▀ ▀▀▀▀▀`;

/**
 * Return the wizard banner styled for the terminal. Honors NO_COLOR and
 * non-TTY contexts via picocolors' built-in detection.
 */
export function renderIntro(): string {
  const coloredBanner = pc.cyan(BANNER);
  const version = pc.dim(`v${CLI_VERSION}`);
  return `${coloredBanner}\n${version}`;
}

export function getCliVersion(): string {
  return CLI_VERSION;
}
