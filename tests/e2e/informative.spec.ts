import { expect, test } from "@playwright/test";
import { FLAG, NEW_SELLER, STORE_OWNER, signIn, siteUrl } from "./helpers";

/**
 * Informative Website end-to-end (docs/informative/PLAN.md "Tests → E2E"). Run against a local
 * Supabase stack with all migrations + seed. The flag-off pass is in flag-off.spec.ts.
 */
test.skip(FLAG !== "all", "flag-on suite");

test("Online Store onboarding with the flag on: Step 0, then the unchanged first step, and Back", async ({ page }) => {
  await page.goto("/start");
  await expect(page).toHaveURL(/\/start\/build$/);
  await expect(page.getByRole("heading", { name: "What do you want to build?" })).toBeVisible();
  await page.getByRole("radio", { name: "Online Store" }).check({ force: true });
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/start\/lang$/);
  await expect(page.getByRole("heading", { name: "Start Your Journey" })).toBeVisible();
  await page.getByRole("button", { name: "← Back" }).click();
  await expect(page).toHaveURL(/\/start\/build$/);
  await expect(page.getByRole("radio", { name: "Online Store" })).toBeChecked();
});

test("store accounts never reach the Informative panel", async ({ page }) => {
  await signIn(page, STORE_OWNER);
  await page.goto("/informative/services");
  await expect(page).toHaveURL(/\/dashboard/);
});

test("full Informative journey: onboard → panel → publish → public site → enquiry → theme switch", async ({ page }) => {
  const slug = `e2e-clinic-${Date.now().toString(36)}`;
  const name = "E2E Calm Clinic";

  await test.step("sign in (existing account) and choose Informative Website", async () => {
    await signIn(page, NEW_SELLER);
    await page.goto("/start");
    await expect(page).toHaveURL(/\/start\/build$/);
    await page.getByRole("radio", { name: "Informative Website" }).check({ force: true });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/start\/informative\/basic-info$/);
  });

  await test.step("Step 1: basic info", async () => {
    await page.getByLabel(/Business name/).fill(name);
    await page.getByLabel(/Business category/).selectOption("clinic_healthcare");
    await page.getByLabel(/^Phone/).fill("98765 43210");
    await page.getByLabel(/^Email/).fill("e2e-clinic@example.test");
    await page.getByLabel(/^City/).fill("Pune");
    await page.getByLabel(/Website address/).fill(slug);
    await expect(page.getByText(`✓ ${slug}.localhost is available`)).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/theme$/);
  });

  await test.step("Step 2: theme (recommended for clinics), preview, select", async () => {
    await expect(page.locator("text=Recommended").first()).toBeVisible();
    await page.getByRole("button", { name: "Preview Zenith Prime" }).click();
    const frame = page.frameLocator("iframe[title^='Zenith Prime preview']");
    await expect(frame.getByRole("heading", { level: 1, name })).toBeVisible();
    await page.getByRole("button", { name: "Mobile" }).click();
    await page.getByRole("button", { name: "Use this design" }).click();
    await expect(page.getByRole("radio", { name: "Zenith Prime" })).toBeChecked();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/services$/);
  });

  await test.step("Step 3: skip services (3 samples will be added)", async () => {
    await page.getByRole("button", { name: "Skip, I'll add later" }).click();
    await expect(page).toHaveURL(/\/account$/);
  });

  await test.step("Step 4: create the website → Informative dashboard", async () => {
    await page.getByRole("button", { name: "Create my website" }).click();
    await expect(page).toHaveURL(/\/informative\/dashboard\?welcome=1/, { timeout: 90_000 });
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByText("Draft · only you can see it")).toBeVisible();
    // The sidebar shows only informative items.
    await expect(page.getByRole("link", { name: "Products" })).toHaveCount(0);
  });

  await test.step("informative accounts never reach store pages", async () => {
    await page.goto("/dashboard/products");
    await expect(page).toHaveURL(/\/informative\/dashboard/);
  });

  await test.step("draft site shows coming soon to the public; store-only paths 404", async () => {
    const res = await page.request.get(siteUrl(slug));
    expect(await res.text()).toContain("Coming soon");
  });

  await test.step("samples are marked; add a real service", async () => {
    await page.goto("/informative/services");
    await expect(page.getByText("Sample").first()).toBeVisible();
    await page.getByRole("link", { name: "Add service" }).first().click();
    await page.getByLabel("Name").fill("E2E Physiotherapy");
    await page.getByLabel("Short description").fill("Recovery from injury and back pain.");
    await page.getByLabel("Price (₹)").fill("800");
    await page.getByRole("button", { name: "Add service" }).click();
    await expect(page).toHaveURL(/\/informative\/services$/);
    await expect(page.getByRole("link", { name: "E2E Physiotherapy" })).toBeVisible();
  });

  await test.step("publish", async () => {
    await page.goto("/informative/dashboard");
    await page.getByRole("button", { name: "Publish website" }).click();
    // The panel re-renders after publishing: status turns Live and the button becomes Unpublish.
    await expect(page.getByText("Status: Live")).toBeVisible();
    await expect(page.getByRole("button", { name: "Unpublish" })).toBeVisible();
  });

  await test.step("public site renders the theme, published content and SEO", async () => {
    await page.goto(siteUrl(slug));
    await expect(page.locator("[data-informative-theme='zenith-prime']")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    const ld = await page.locator("script[type='application/ld+json']").allTextContents();
    expect(ld.join(" ")).toContain('"LocalBusiness"');
    expect((await page.request.get(siteUrl(slug, "/cart"))).status()).toBe(404);
    const sitemap = await (await page.request.get(siteUrl(slug, "/sitemap.xml"))).text();
    expect(sitemap).toContain("/services/e2e-physiotherapy");
  });

  await test.step("submit an enquiry from the service page", async () => {
    await page.goto(siteUrl(slug, "/services/e2e-physiotherapy"));
    await expect(page.getByRole("heading", { level: 1, name: "E2E Physiotherapy" })).toBeVisible();
    await page.getByLabel(/^Name/).fill("E2E Visitor");
    await page.getByLabel(/^Phone/).fill("+91 99887 76655");
    await page.getByLabel("Message").fill("Do you have a slot on Saturday?");
    await page.getByRole("checkbox", { name: /may contact me/ }).check();
    await page.getByRole("button", { name: "Send enquiry" }).click();
    await expect(page.getByRole("status")).toContainText(/received your enquiry|Thank you/);
  });

  await test.step("the enquiry is in the panel inbox", async () => {
    await page.goto("/informative/enquiries");
    await expect(page.getByRole("link", { name: "E2E Visitor" })).toBeVisible();
    await page.getByRole("link", { name: "E2E Visitor" }).click();
    await expect(page.getByText("Do you have a slot on Saturday?")).toBeVisible();
    await expect(page.locator("dd", { hasText: "E2E Physiotherapy" })).toBeVisible(); // the lead's service
    // The detail form's own fields (the filter bar above also has a "Status" select).
    await page.locator("#f-status").selectOption("CONTACTED");
    await page.locator("#f-notes").fill("Called back, booked Saturday 10am.");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
  });

  await test.step("theme switch keeps all content", async () => {
    await page.goto("/informative/appearance");
    await page.locator("#th-pure-gold").click(); // the visible label of the (visually hidden) radio
    await expect(page.getByRole("radio", { name: "Pure Gold" })).toBeChecked();
    await page.getByRole("button", { name: "Save appearance" }).click();
    await expect(page.getByText(/Your content stays the same/)).toBeVisible();
    await page.goto(siteUrl(slug, "/services"));
    await expect(page.locator("[data-informative-theme='pure-gold']")).toBeVisible();
    await expect(page.getByRole("link", { name: "E2E Physiotherapy" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "General consultation" }).first()).toBeVisible();
  });
});
