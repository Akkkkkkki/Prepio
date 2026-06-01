import { expect, test } from "@playwright/test";

/**
 * Smoke test: the public landing page boots and serves the app shell.
 *
 * The title lives in index.html, so this passes as long as the dev server is
 * up and serving the SPA — it does not require Supabase env vars to be set.
 */
test("landing page serves the app shell", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Prepio/);
});
