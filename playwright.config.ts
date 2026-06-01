import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright end-to-end config for Prepio.
 *
 * Tests run against the Vite dev server (port 5173). Playwright starts the
 * server automatically via `webServer` and reuses an already-running one
 * locally.
 *
 * Note: the Chromium binary must be installed first (`npx playwright install
 * chromium`). In Claude Code on the web this is handled by the SessionStart
 * hook in `.claude/hooks/session-start.sh`, which requires `cdn.playwright.dev`
 * to be present in the environment's network allowlist.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "list" : "html",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
