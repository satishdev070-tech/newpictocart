import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests (Informative Website, docs/informative/PLAN.md M8). NOT part of `pnpm check` or
 * CI: they need a local Supabase stack with every migration + supabase/seed.sql. Run:
 *
 *   E2E_SUPABASE_URL=… E2E_SUPABASE_PUBLISHABLE_KEY=… E2E_SUPABASE_SECRET_KEY=… pnpm test:e2e
 *   E2E_FLAG=off pnpm test:e2e            # the flag-off pass (Step 0 hidden, routes 404)
 *
 * Set CHROMIUM_PATH to use an installed Chrome when Playwright's browsers are not downloaded.
 */
const port = Number(process.env.E2E_PORT ?? 3013);
const flag = process.env.E2E_FLAG === "off" ? "off" : "all";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  // One retry absorbs `next dev` first-compile slowness; every run uses a fresh slug.
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    navigationTimeout: 90_000,
    actionTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {} },
    },
  ],
  webServer: {
    command: `pnpm dev --port ${port}`,
    url: `http://localhost:${port}/login`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      FEATURE_INFORMATIVE_WEBSITE: flag,
      NEXT_PUBLIC_SUPABASE_URL: process.env.E2E_SUPABASE_URL ?? "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.E2E_SUPABASE_PUBLISHABLE_KEY ?? "",
      SUPABASE_SECRET_KEY: process.env.E2E_SUPABASE_SECRET_KEY ?? "",
      NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN: "localhost",
      NEXT_PUBLIC_PLATFORM_URL: `http://localhost:${port}`,
      APP_SECRET: process.env.E2E_APP_SECRET ?? "e2e-only-app-secret-0123456789abcdef",
    },
  },
});
