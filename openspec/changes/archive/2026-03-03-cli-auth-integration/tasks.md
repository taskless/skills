## 1. API Base URL Configuration

- [x] 1.1 Add an `API_BASE_URL` constant (defaulting to `https://app.taskless.io/cli`) and a `getApiBaseUrl()` helper that reads `TASKLESS_API_URL` env var with fallback to the default, in a shared location accessible to both auth and future API providers (e.g., `packages/cli/src/actions/api-config.ts`)

## 2. Replace Stub with Real HTTP Provider

- [x] 2.1 In `packages/cli/src/actions/device-flow.ts`, replace `StubDeviceFlowProvider` with `HttpDeviceFlowProvider` that uses `fetch` to call `POST {baseUrl}/auth/device` with `{ client_id: "taskless-cli" }` and returns the parsed `DeviceCodeResponse`
- [x] 2.2 Implement `pollForToken` in `HttpDeviceFlowProvider` that calls `POST {baseUrl}/auth/token` with `{ grant_type: "urn:ietf:params:oauth:grant-type:device_code", device_code, client_id: "taskless-cli" }` and maps the response to the existing `TokenPollResult` union type
- [x] 2.3 Handle non-200 responses and network errors with descriptive error messages
- [x] 2.4 Update the exported `deviceFlowProvider` instance to use `HttpDeviceFlowProvider`

## 3. Command UX Adjustments

- [x] 3.1 Review `packages/cli/src/commands/auth.ts` login handler — remove the "API not yet available" scenario from the existing spec (the stub no longer exists). Verify the existing polling loop, token save, and error handling work with real responses.

## 4. Build and Validation

- [x] 4.1 Run `pnpm typecheck` and fix any type errors
- [x] 4.2 Run `pnpm lint` and fix any lint issues
- [x] 4.3 Run `pnpm build` and verify the CLI bundles correctly
