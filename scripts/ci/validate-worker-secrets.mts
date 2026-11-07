/**
 * CI guard: parse a Worker secrets JSON file with serverEnvSchema and print
 * field-level errors (never values). Exit 1 on failure so GHA never uploads
 * secrets that would make the Worker throw EnvValidationError on every request.
 *
 * Usage: pnpm exec tsx scripts/ci/validate-worker-secrets.mts /tmp/worker-secrets.json
 */
import { readFileSync } from "node:fs";
import { EnvValidationError, parseEnv, serverEnvSchema } from "../../src/lib/env/schema.ts";

const path = process.argv[2];
if (!path) {
  console.error("usage: validate-worker-secrets.mts <secrets.json>");
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

// Lengths only — helps compare GitHub vs a known-good Worker without leaking values.
for (const k of Object.keys(source).sort()) {
  const v = source[k];
  const len = v?.length ?? 0;
  const ws = v !== undefined && v !== v.trim();
  console.log(`${k}: len=${len}${ws ? " has_edge_whitespace=true" : ""}`);
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
