import { afterEach, describe, expect, it, vi } from "vitest";

const importConfig = async (env: Record<string, string | undefined> = {}) => {
  vi.resetModules();
  vi.stubGlobal("Deno", {
    env: {
      get: (name: string) => env[name],
    },
  });

  return import("./config.ts");
};

describe("profile story linking flag", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps profile story linking disabled unless explicitly enabled", async () => {
    const { RESEARCH_CONFIG } = await importConfig();

    expect(RESEARCH_CONFIG.features.profileStoryLinking).toBe(false);
  });

  it("enables profile story linking from PROFILE_STORY_LINKING", async () => {
    const { RESEARCH_CONFIG } = await importConfig({ PROFILE_STORY_LINKING: "true" });

    expect(RESEARCH_CONFIG.features.profileStoryLinking).toBe(true);
  });
});
