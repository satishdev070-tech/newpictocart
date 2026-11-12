import { expect, test } from "@playwright/test";
import { FLAG } from "./helpers";

/** With FEATURE_INFORMATIVE_WEBSITE off the app is identical to before (run with E2E_FLAG=off). */
test.skip(FLAG !== "off", "flag-off suite");

test("Online Store onboarding with the flag off: no Step 0, no Back", async ({ page }) => {
  await page.goto("/start");
  await expect(page).toHaveURL(/\/start\/lang$/);
  await expect(page.getByRole("heading", { name: "Start Your Journey" })).toBeVisible();
  await expect(page.getByRole("button", { name: "← Back" })).toHaveCount(0);
});

test("informative routes 404 with the flag off", async ({ page }) => {
  for (const path of ["/start/build", "/start/informative/basic-info", "/informative/dashboard", "/informative/preview/nexus-core"]) {
    const res = await page.request.get(path, { maxRedirects: 0 });
    expect([307, 404], path).toContain(res.status());
    if (res.status() === 307) expect(res.headers().location, path).toMatch(/\/start\/lang$/);
  }
});
