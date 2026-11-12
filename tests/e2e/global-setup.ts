import type { FullConfig } from "@playwright/test";

/**
 * `next dev` compiles each route on first request; a navigation that lands mid-compile can drop the
 * stream. Warm the routes the journey uses once, before any test runs (dev-only concern).
 */
const ROUTES = [
  "/login", "/start/build", "/start/lang", "/start/informative/basic-info", "/start/informative/theme", "/start/informative/services",
  "/start/informative/account", "/start/informative/finish", "/informative/dashboard", "/informative/services", "/informative/services/new",
  "/informative/enquiries", "/informative/appearance", "/informative/preview/zenith-prime", "/dashboard",
];

export default async function globalSetup(config: FullConfig) {
  const base = config.projects[0]?.use.baseURL ?? "http://localhost:3013";
  for (const path of ROUTES) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await fetch(`${base}${path}`, { redirect: "manual", signal: AbortSignal.timeout(120_000) });
        break;
      } catch {
        // retry: the compiler may still be busy
      }
    }
  }
}
