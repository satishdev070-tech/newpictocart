/**
 * CI guard: parse a Worker secrets JSON file with serverEnvSchema and print
 * field-level errors (never values). Exit 1 on failure so GHA never uploads
 * secrets that would make the Worker throw EnvValidationError on every request.
 *
 * Also guards incomplete production secrets files: `cf deploy --secrets-file`
 * replaces Worker secret bindings with the file contents. Omitting EMAIL_FROM /
 * RESEND_API_KEY / GOOGLE_IDENTITY_SIGNIN wipes those bindings and breaks seller
 * OTP email (or GIS). Prefer a complete JSON every deploy.
 *
 * Usage:
 *   pnpm exec tsx scripts/ci/validate-worker-secrets.mts /tmp/worker-secrets.json
 *   pnpm exec tsx scripts/ci/validate-worker-secrets.mts /tmp/worker-secrets.json --allow-db-resend
 */
import { readFileSync } from "node:fs";
import { EnvValidationError, parseEnv, serverEnvSchema } from "../../src/lib/env/schema";

const args = process.argv.slice(2).filter((a) => a !== "--");
const allowDbResend = args.includes("--allow-db-resend");
const path = args.find((a) => !a.startsWith("--"));
if (!path) {
  console.error("usage: validate-worker-secrets.mts <secrets.json> [--allow-db-resend]");
  process.exit(2);
}

const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
  console.error("secrets file must be a JSON object");
  process.exit(1);
}

const source: Record<string, string | undefined> = {};
for (const [k, v] of Object.entries(raw)) {
  if (v === undefined || v === null) {
    source[k] = undefined;
    continue;
  }
  if (typeof v !== "string") {
    console.error(`${k}: must be a string (got ${typeof v})`);
    process.exit(1);
  }
  source[k] = v;
}

/** Keys that must be present on every production Worker secrets upload (wipe-safe). */
const REQUIRED_WIPE_SAFE = [
  "APP_SECRET",
  "CRON_SECRET",
  "SUPABASE_SECRET_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN",
  "NEXT_PUBLIC_PLATFORM_URL",
  "EMAIL_FROM",
] as const;

/** Optional but commonly wiped by incomplete files — warn when missing. */
const OPTIONAL_WIPE_WARN = ["PLATFORM_HOST_ALIASES", "WORKERS_DEV_HOST", "GOOGLE_IDENTITY_SIGNIN", "RESEND_API_KEY"] as const;

// Lengths only — helps compare GitHub vs a known-good Worker without leaking values.
for (const k of Object.keys(source).sort()) {
  const v = source[k];
  const len = v?.length ?? 0;
  const ws = v !== undefined && v !== v.trim();
  console.log(`${k}: len=${len}${ws ? " has_edge_whitespace=true" : ""}`);
}

let failed = false;
for (const k of REQUIRED_WIPE_SAFE) {
  const v = source[k]?.trim();
  if (!v) {
    console.error(
      `${k}: required in Worker secrets file. \`cf deploy --secrets-file\` replaces secret bindings; omitting ${k} wipes it and can break login/email/HMAC.`,
    );
    failed = true;
  }
}

const resend = source.RESEND_API_KEY?.trim();
if (!resend) {
  if (allowDbResend) {
    console.log(
      "RESEND_API_KEY: omitted (allowed via --allow-db-resend). Worker must decrypt Admin → Email (Resend) with this same APP_SECRET; rotating APP_SECRET breaks DB Resend.",
    );
  } else {
    console.error(
      "RESEND_API_KEY: missing. Include it in the secrets file, or pass --allow-db-resend only when Admin → Email already stores Resend encrypted under this APP_SECRET. Incomplete secrets files wipe env Resend and break OTP when DB decrypt also fails.",
    );
    failed = true;
  }
}

for (const k of OPTIONAL_WIPE_WARN) {
  if (k === "RESEND_API_KEY") continue;
  if (!source[k]?.trim()) {
    console.log(`${k}: omitted (optional). Note: --secrets-file replace will remove any existing Worker binding for ${k}.`);
  }
}

try {
  parseEnv(serverEnvSchema, { ...source, NODE_ENV: "production" });
  console.log("serverEnvSchema: ok");
} catch (e) {
  if (e instanceof EnvValidationError) {
    console.error(e.message);
    process.exit(1);
  }
  throw e;
}

if (failed) process.exit(1);
console.log("wipe-safe secrets: ok");
