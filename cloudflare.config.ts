import { bindings, defineConfig, defineWorker } from "cf/config";
import { createWorkersCacheConfig } from "@vinext/cloudflare/cache/config";

const cache = await createWorkersCacheConfig();

/**
 * vinext app Worker (production + canary). Serves pictocart.in / www / *.pictocart.in
 * and pictocartdev.in aliases — see docs/DEPLOY_CLOUDFLARE_WORKERS.md.
 * Cron Triggers need Workers Paid (Free = 0 schedules). Until then, HTTP-call
 * `/api/cron/*` with `Authorization: Bearer $CRON_SECRET`.
 * To enable on Paid: import { triggers } from "cf/config" and add
 * `triggers: [triggers.scheduled({ schedule: "0 0 * * *" })]`.
 */
export default defineConfig({
  worker: defineWorker({
    ...cache,
    name: "pictocart",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-05",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ...cache.env,
      ASSETS: bindings.assets(),
      IMAGES: bindings.images(),
      // Pin to the existing Airy Fact namespace — unpinned bindings.kv() makes `cf deploy`
      // (strict by default in CI) abort when local config differs from the remote Worker.
      VINEXT_KV_CACHE: bindings.kv({ id: "2a8074bf01e4433d824ab34d9531cf0b" }),
    },
  }),
});
