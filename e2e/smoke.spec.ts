import { expect, test } from "@playwright/test";

// No live credentials or provider requests. The test server gets placeholder
// Supabase configuration; any accidental network work is caught below.
for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`guest sample and invited sign-in (${viewport.width}px)`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const externalRequests: string[] = [];
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route(/\/functions\/v1\/|\/rest\/v1\/|\/auth\/v1\/|api\.openai\.com|api\.tavily\.com/, route => {
      externalRequests.push(route.request().url());
      return route.abort();
    });
    await page.goto("/");
    await expect(page).toHaveTitle(/Prepio/);
    await expect(page.getByRole("heading", { name: "Prepare for your next interview" })).toBeVisible();
    await page.getByRole("button", { name: "View sample plan" }).click();
    await expect(page.getByRole("heading", { name: "Payments company · Product Manager" })).toBeVisible();
    await expect(page.getByRole("link", { name: /pricing|upgrade/i })).toHaveCount(0);
    expect(externalRequests).toEqual([]);
    await page.getByRole("link", { name: "Sign in to prepare your interview" }).click();
    await expect(page).toHaveURL(/\/auth$/);
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await expect(page.getByText(/free and invite-only/)).toBeVisible();
    await expect(page.getByRole("button", { name: /create account/i })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test("retired routes cannot activate billing or profile work", async ({ page }) => {
  const calls: string[] = [];
  await page.route(/\/functions\/v1\/|\/rest\/v1\//, route => {
    calls.push(route.request().url());
    return route.abort();
  });
  for (const path of ["/pricing?checkout=monthly", "/billing/return", "/profile/import", "/settings"]) {
    await page.goto(path);
    await expect(page.getByText("404", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /checkout|upgrade|import/i })).toHaveCount(0);
  }
  expect(calls).toEqual([]);
});
