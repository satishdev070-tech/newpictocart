import { expect, test, type APIRequestContext } from "@playwright/test";
import { FLAG, PORT, SEED_PASSWORD, signIn } from "./helpers";

/**
 * Online Store regression checklist (docs/informative/PLAN.md "Online Store regression checklist"),
 * run with the Informative flag ON: the store journey, the data it creates, existing storefronts
 * and pre-existing rows are exactly as before.
 */
test.skip(FLAG !== "all", "runs in the flag-on pass");

const API = process.env.E2E_SUPABASE_URL ?? "";
const KEY = process.env.E2E_SUPABASE_SECRET_KEY ?? "";
const admin = { apikey: KEY, Authorization: `Bearer ${KEY}`, "content-type": "application/json" };

async function rest<T>(request: APIRequestContext, path: string): Promise<T> {
  const res = await request.get(`${API}/rest/v1/${path}`, { headers: admin });
  expect(res.ok(), `${path}: ${res.status()}`).toBe(true);
  return (await res.json()) as T;
}

test("every pre-existing tenant is ONLINE_STORE", async ({ request }) => {
  const rows = await rest<{ slug: string; website_type: string }[]>(request, "tenants?select=slug,website_type&slug=in.(aangan,rangrez)");
  expect(rows).toHaveLength(2);
  for (const r of rows) expect(r.website_type).toBe("ONLINE_STORE");
});

test("an existing storefront still renders as a store", async ({ page }) => {
  const res = await page.goto(`http://aangan.localhost:${PORT}/`);
  expect(res?.status()).toBe(200);
  await expect(page.locator("[data-sf-root]")).toBeVisible();
  await expect(page.locator("[data-informative-theme]")).toHaveCount(0);
});

test("existing seller lands on the same store dashboard", async ({ page }) => {
  await signIn(page, "owner@aangan.test");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("link", { name: "Products" }).first()).toBeVisible();
});

test("new Online Store onboarding (flag on) completes with the same steps and store data", async ({ page, request }) => {
  const email = `e2e-seller-${Date.now().toString(36)}@example.test`;
  const created = await request.post(`${API}/auth/v1/admin/users`, { headers: admin, data: { email, password: SEED_PASSWORD, email_confirm: true } });
  expect(created.ok(), `create user: ${created.status()}`).toBe(true);
  const userId = ((await created.json()) as { id: string }).id;

  await signIn(page, email);
  await page.goto("/start");
  await expect(page).toHaveURL(/\/start\/build$/);
  await page.getByRole("radio", { name: "Online Store" }).check({ force: true });
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/start\/lang$/);
  await page.getByRole("button", { name: /Continue in English/ }).click();
  await expect(page).toHaveURL(/\/start\/path$/);
  await page.getByRole("heading", { name: "Quick Setup Quiz" }).click();
  await page.getByRole("button", { name: /Start the quiz/ }).click();
  await expect(page).toHaveURL(/\/start\/quiz$/);
  await page.getByRole("textbox").first().fill("E2E Clay Works");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Handicrafts" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Pottery" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page).toHaveURL(/\/start\/theme$/);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  // Signed in: the store is created straight away (same as before this feature).
  await expect(page).toHaveURL(/\/start\/done/, { timeout: 150_000 });

  const memberships = await rest<{ tenant_id: string }[]>(request, `tenant_memberships?select=tenant_id&user_id=eq.${userId}&role=eq.owner`);
  expect(memberships).toHaveLength(1);
  const t = memberships[0]!.tenant_id;
  const [tenant] = await rest<{ website_type: string }[]>(request, `tenants?select=website_type&id=eq.${t}`);
  expect(tenant?.website_type).toBe("ONLINE_STORE");
  const [store] = await rest<{ site_mode: string }[]>(request, `stores?select=site_mode&tenant_id=eq.${t}`);
  expect(store?.site_mode).toBe("ecommerce");
  expect(await rest<unknown[]>(request, `inventory_locations?select=id&tenant_id=eq.${t}`)).toHaveLength(1);
  expect((await rest<unknown[]>(request, `shipping_rates?select=id&tenant_id=eq.${t}`)).length).toBeGreaterThan(0);
  expect((await rest<unknown[]>(request, `products?select=id&tenant_id=eq.${t}`)).length).toBeGreaterThan(0);
  expect(await rest<unknown[]>(request, `info_sites?select=tenant_id&tenant_id=eq.${t}`)).toHaveLength(0);
});
