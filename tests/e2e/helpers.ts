import { expect, type Page } from "@playwright/test";

export const FLAG = process.env.E2E_FLAG === "off" ? "off" : "all";
export const PORT = Number(process.env.E2E_PORT ?? 3013);
/** Seed users (supabase/seed.sql): one password for all. */
export const SEED_PASSWORD = "Paliya@12345";
export const STORE_OWNER = "owner@aangan.test";
/** Owns no store: free to create an Informative Website. */
export const NEW_SELLER = "shopper@example.test";

/** Password sign-in through the real /login page. */
export async function signIn(page: Page, email: string, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByRole("tab", { name: "Password" }).or(page.getByRole("button", { name: "Password" })).first().click();
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/^password/i).first().fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /^(sign in|log in|continue)/i }).last().click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 60_000 });
}

export function siteUrl(slug: string, path = "/") {
  return `http://${slug}.localhost:${PORT}${path}`;
}
