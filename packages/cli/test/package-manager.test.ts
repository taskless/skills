import { describe, expect, it, afterEach } from "vitest";
import { getCliPrefix } from "../src/util/package-manager";

describe("getCliPrefix", () => {
  const originalUa = process.env.npm_config_user_agent;

  afterEach(() => {
    if (originalUa === undefined) {
      delete process.env.npm_config_user_agent;
    } else {
      process.env.npm_config_user_agent = originalUa;
    }
  });

  it("returns pnpm dlx for pnpm", () => {
    process.env.npm_config_user_agent = "pnpm/9.1.0 node/v22.0.0";
    expect(getCliPrefix()).toBe("pnpm dlx @taskless/cli@latest");
  });

  it("returns yarn dlx for Yarn Berry (v2+)", () => {
    process.env.npm_config_user_agent = "yarn/4.1.0 node/v22.0.0";
    expect(getCliPrefix()).toBe("yarn dlx @taskless/cli@latest");
  });

  it("falls back to npx for Yarn Classic (v1)", () => {
    process.env.npm_config_user_agent = "yarn/1.22.19 node/v20.0.0";
    expect(getCliPrefix()).toBe("npx @taskless/cli@latest");
  });

  it("returns bunx for bun", () => {
    process.env.npm_config_user_agent = "bun/1.0.0 node/v22.0.0";
    expect(getCliPrefix()).toBe("bunx @taskless/cli@latest");
  });

  it("returns npx for npm", () => {
    process.env.npm_config_user_agent = "npm/10.0.0 node/v22.0.0";
    expect(getCliPrefix()).toBe("npx @taskless/cli@latest");
  });

  it("returns npx when user agent is unset", () => {
    delete process.env.npm_config_user_agent;
    expect(getCliPrefix()).toBe("npx @taskless/cli@latest");
  });
});
