## 1. Token Storage Layer

- [x] 1.1 Create `packages/cli/src/actions/token.ts` with `getConfigDir()` that resolves `$XDG_CONFIG_HOME/taskless/` (default `~/.config/taskless/`)
- [x] 1.2 Add `getToken()` function: check `TASKLESS_TOKEN` env var first, then read `auth.json` from config dir, return `string | null`
- [x] 1.3 Add `saveToken(data)` function: write to `auth.json` with `0600` permissions, creating the config directory if needed
- [x] 1.4 Add `removeToken()` function: delete `auth.json` if it exists

## 2. Network Interface and Stub

- [x] 2.1 Define `DeviceFlowProvider` interface in `packages/cli/src/actions/device-flow.ts` with methods for `requestDeviceCode()` and `pollForToken()`
- [x] 2.2 Implement a stub provider that returns an error indicating auth is not yet available
- [x] 2.3 Export a factory or default instance that commands can import

## 3. Auth Commands

- [x] 3.1 Create `packages/cli/src/commands/auth.ts` with `authCommand` as a citty subcommand group containing `login` and `logout`
- [x] 3.2 Implement `login` handler: check for existing token, initiate device flow via provider, display URL and code, poll for token, save on success
- [x] 3.3 Implement `logout` handler: call `removeToken()`, print confirmation or "not logged in"
- [x] 3.4 Register `authCommand` in `packages/cli/src/index.ts` alongside existing subcommands

## 4. Info Command Update

- [x] 4.1 Update `packages/cli/src/commands/info.ts` to call `getToken()` and include `loggedIn: boolean` in the JSON output

## 5. Build and Validation

- [x] 5.1 Run `pnpm typecheck` and fix any type errors
- [x] 5.2 Run `pnpm lint` and fix any lint issues
- [x] 5.3 Run `pnpm build` and verify the CLI bundles correctly with new modules
