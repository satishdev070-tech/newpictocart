import { expect, test } from "@playwright/test";
import { FLAG, NEW_SELLER, signIn } from "./helpers";

/**
 * Informative M9: service types at onboarding seed a ready-made site; the panel AI assistant.
 * The e2e stack has no AI provider keys, so this covers the no-AI path: the starter content stays
 * and the assistant explains that AI isn't set up.
 */
test.skip(FLAG !== "all", "flag-on suite");

test("service type → seeded services and FAQs; assistant without AI keys", async ({ page }) => {
  const slug = `e2e-dent-${Date.now().toString(36)}`;

  await test.step("choose Informative Website", async () => {
    await signIn(page, NEW_SELLER);
    await page.goto("/start");
    await page.getByRole("radio", { name: "Informative Website" }).check({ force: true });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/start\/informative\/basic-info$/);
  });

  await test.step("Step 1: category, then a service from that category", async () => {
    await page.getByLabel(/Business name/).fill("E2E Smile Care");
    const service = page.getByLabel(/^Your service/);
    await expect(service).toBeDisabled();
    await page.getByLabel(/Business category/).selectOption("clinic_healthcare");
    await service.selectOption("dentist");
    // "Type your own" shows a text field; switching back hides it.
    await service.selectOption("custom");
    await expect(page.getByLabel(/What service do you offer/)).toBeVisible();
    await service.selectOption("dentist");
    await expect(page.getByLabel(/What service do you offer/)).toHaveCount(0);
    await expect(page.getByLabel(/^Tagline/)).toHaveAttribute("placeholder", /Gentle dental care/);
    await page.getByLabel(/^Phone/).fill("98765 43210");
    await page.getByLabel(/^Email/).fill("e2e-dent@example.test");
    await page.getByLabel(/^City/).fill("Pune");
    await page.getByLabel(/Website address/).fill(slug);
    await expect(page.getByText(`✓ ${slug}.localhost is available`)).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/theme$/);
  });

  await test.step("Step 2: keep a theme", async () => {
    // The radio is visually hidden inside its card; click the card like a person would.
    await page.locator('label:has(input[name="theme"][value="zenith-prime"])').click();
    await expect(page.getByRole("radio", { name: "Zenith Prime" })).toBeChecked();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/services$/);
  });

  await test.step("Step 3: services are pre-filled for a dentist (up to 6)", async () => {
    await expect(page.getByText("We've suggested services for your business.")).toBeVisible();
    const names = page.getByLabel("Service name");
    await expect(names).toHaveCount(6);
    await expect(names.first()).toHaveValue("Dental check-up");
    await names.nth(5).fill("Braces consultation");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/account$/);
  });

  await test.step("create: AI isn't configured, so the starter content stays", async () => {
    await page.getByRole("button", { name: "Create my website" }).click();
    await expect(page).toHaveURL(/\/informative\/dashboard\?welcome=1/, { timeout: 150_000 });
  });

  await test.step("the site has the dentist services, About text and FAQs", async () => {
    await page.goto("/informative/services");
    await expect(page.getByRole("link", { name: "Root canal treatment" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Braces consultation" })).toBeVisible();
    await expect(page.getByText("Sample")).toHaveCount(0);
    await page.goto("/informative/faqs");
    await expect(page.getByRole("heading", { name: "Do you treat children?", exact: true })).toBeVisible();
    await page.goto("/informative/business");
    await expect(page.getByLabel(/^About your business/)).toHaveValue(/E2E Smile Care is a dental clinic in Pune/);
    await expect(page.getByLabel(/^Tagline/)).toHaveValue("Gentle dental care for the whole family");
  });

  await test.step("AI assistant opens and explains that AI isn't set up", async () => {
    await page.getByRole("button", { name: "AI assistant" }).click();
    const panel = page.getByRole("dialog", { name: "Website assistant" });
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: "Write my About page" }).click();
    await expect(panel.getByText(/AI writing isn't set up yet/)).toBeVisible();
    await panel.getByRole("button", { name: "Close assistant" }).click();
    await expect(panel).toHaveCount(0);
  });
});
