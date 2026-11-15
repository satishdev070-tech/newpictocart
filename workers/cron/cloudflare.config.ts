import { bindings, defineConfig, defineWorker, triggers } from "cf/config";

/**
 * Production-only scheduler Worker (ADR-043). Deployed by .github/workflows/deploy-cron-worker.yml
 * with a secrets file holding CRON_SECRET. No routes, no workers.dev URL.
 */
export default defineConfig({
  worker: defineWorker({
    name: "pictocart-cron",
    entrypoint: "./src/index.ts",
    compatibilityDate: "2026-11-05",
    workersDev: false,
    // Must equal the keys of SCHEDULES in src/schedule.ts (the config loader cannot import TS);
    // tests/unit/ci/cron-worker.test.ts enforces it.
    triggers: [
      triggers.scheduled({ schedule: "*/5 * * * *" }),
      triggers.scheduled({ schedule: "7,37 * * * *" }),
      triggers.scheduled({ schedule: "23 2 * * *" }),
    ],
    observability: { enabled: true, logs: { enabled: true, invocationLogs: true, headSamplingRate: 1 } },
    env: {
      APP: bindings.worker({ worker: "pictocart" }),
      APP_ORIGIN: bindings.text("https://www.pictocart.in"),
      CRON_SECRET: bindings.secret(),
    },
  }),
});
