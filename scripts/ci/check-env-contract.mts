/**
 * CI guard: environment variable NAMES stay in sync (never reads values).
 *  - every variable in `serverEnvSchema` is documented in `.env.example`;
 *  - every Worker secrets key the deploy workflow writes is a variable the app knows;
 *  - the keys `cf deploy --secrets-file` must never omit (validate-worker-secrets) are all written.
 *
 * Usage: pnpm exec tsx scripts/ci/check-env-contract.mts
 */
import { readFileSync } from "node:fs";
import { serverEnvSchema } from "../../src/lib/env/schema";

/** Read by the app outside serverEnvSchema (platform hosts, feature switches, deploy metadata). */
const EXTRA_RUNTIME_KEYS = new Set(["WORKERS_DEV_HOST", "GOOGLE_IDENTITY_SIGNIN", "DEPLOY_COMMIT_SHA", "DEPLOY_ENVIRONMENT"]);
/** Documented in .env.example but read only by scripts or optional integrations. */
const EXAMPLE_ONLY_ALLOWED = new Set(["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "SUPER_ADMIN_EMAIL", "SUPER_ADMIN_INITIAL_PASSWORD"]);
const WIPE_SAFE = ["APP_SECRET", "CRON_SECRET", "SUPABASE_SECRET_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN", "NEXT_PUBLIC_PLATFORM_URL", "EMAIL_FROM"];

const schemaKeys = new Set(Object.keys(serverEnvSchema.shape).filter((k) => k !== "NODE_ENV"));
const exampleKeys = new Set([...readFileSync(".env.example", "utf8").matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]!));
// Keys of the JSON payload in the reusable deploy workflow (`payload = { "KEY": ... }` and `payload["KEY"] = ...`).
const workflow = readFileSync(".github/workflows/deploy-worker.yml", "utf8");
const writtenKeys = new Set([...workflow.matchAll(/^\s*(?:payload\[)?"([A-Z][A-Z0-9_]*)"\]?\s*[:=]/gm)].map((m) => m[1]!));

const errors: string[] = [];
for (const k of schemaKeys) if (!exampleKeys.has(k)) errors.push(`${k}: in serverEnvSchema but missing from .env.example`);
for (const k of exampleKeys) if (!schemaKeys.has(k) && !EXTRA_RUNTIME_KEYS.has(k) && !EXAMPLE_ONLY_ALLOWED.has(k)) errors.push(`${k}: in .env.example but unknown to serverEnvSchema (typo, or add it to the schema / allowlist here)`);
for (const k of writtenKeys) if (!schemaKeys.has(k) && !EXTRA_RUNTIME_KEYS.has(k)) errors.push(`${k}: written to the Worker secrets file but unknown to the app`);
for (const k of WIPE_SAFE) if (!writtenKeys.has(k)) errors.push(`${k}: required on every Worker deploy but not written by deploy-worker.yml`);

console.log(`serverEnvSchema: ${schemaKeys.size} keys · .env.example: ${exampleKeys.size} keys · deploy secrets file: ${writtenKeys.size} keys`);
if (errors.length) {
  for (const e of errors) console.error(`::error::${e}`);
  process.exit(1);
}
console.log("env contract: ok");
