#!/usr/bin/env tsx
/**
 * Smoke checks for Cloudflare-in-front-of-Vercel cutover.
 *
 * Usage:
 *   pnpm exec tsx scripts/ops/smoke-cloudflare-hosts.mts
 *   pnpm exec tsx scripts/ops/smoke-cloudflare-hosts.mts --canary
 *   pnpm exec tsx scripts/ops/smoke-cloudflare-hosts.mts --prod
 *   pnpm exec tsx scripts/ops/smoke-cloudflare-hosts.mts --expect-cf
 *
 * Exit 0 only if all probed URLs return healthy JSON / 2xx where required.
 * Prints whether responses look Cloudflare-proxied (`cf-ray`) vs Vercel-direct.
 */

type Mode = "all" | "canary" | "prod";

const args = new Set(process.argv.slice(2));
const mode: Mode = args.has("--canary") ? "canary" : args.has("--prod") ? "prod" : "all";
const expectCf = args.has("--expect-cf");

type Probe = {
  label: string;
  url: string;
  kind: "health" | "ready" | "html";
};

const canary: Probe[] = [
  { label: "canary health", url: "https://www.pictocartdev.in/api/health", kind: "health" },
  { label: "canary ready", url: "https://www.pictocartdev.in/api/health/ready", kind: "ready" },
  { label: "canary home", url: "https://www.pictocartdev.in/", kind: "html" },
  { label: "canary seller login", url: "https://www.pictocartdev.in/seller/login", kind: "html" },
];

const prod: Probe[] = [
  { label: "prod health", url: "https://www.pictocart.in/api/health", kind: "health" },
  { label: "prod ready", url: "https://www.pictocart.in/api/health/ready", kind: "ready" },
  { label: "prod home", url: "https://www.pictocart.in/", kind: "html" },
  { label: "prod seller login", url: "https://www.pictocart.in/seller/login", kind: "html" },
];

const probes = mode === "canary" ? canary : mode === "prod" ? prod : [...canary, ...prod];

type Result = {
  label: string;
  url: string;
  ok: boolean;
  status: number;
  via: "cloudflare" | "vercel" | "other";
  detail: string;
};

async function probeOne(p: Probe): Promise<Result> {
  try {
    const res = await fetch(p.url, {
      redirect: "follow",
      headers: { accept: p.kind === "html" ? "text/html" : "application/json" },
    });
    const cfRay = res.headers.get("cf-ray");
    const server = (res.headers.get("server") || "").toLowerCase();
    const via: Result["via"] = cfRay ? "cloudflare" : server.includes("vercel") ? "vercel" : "other";

    if (p.kind === "html") {
      const ok = res.status >= 200 && res.status < 400;
      return {
        label: p.label,
        url: p.url,
        ok,
        status: res.status,
        via,
        detail: ok ? "document ok" : `unexpected status ${res.status}`,
      };
    }

    const body = (await res.json()) as { ok?: boolean; env?: { ok?: boolean }; supabase?: { ok?: boolean } };
    if (p.kind === "health") {
      const ok = res.status === 200 && body.ok === true;
      return {
        label: p.label,
        url: p.url,
        ok,
        status: res.status,
        via,
        detail: ok ? "ok:true" : JSON.stringify(body).slice(0, 200),
      };
    }

    const ok = res.status === 200 && body.ok === true && body.env?.ok === true && body.supabase?.ok === true;
    return {
      label: p.label,
      url: p.url,
      ok,
      status: res.status,
      via,
      detail: ok
        ? "ready"
        : `env=${String(body.env?.ok)} supabase=${String(body.supabase?.ok)}`,
    };
  } catch (err) {
    return {
      label: p.label,
      url: p.url,
      ok: false,
      status: 0,
      via: "other",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

const results = await Promise.all(probes.map(probeOne));
let failed = 0;

for (const r of results) {
  const mark = r.ok ? "PASS" : "FAIL";
  if (!r.ok) failed += 1;
  console.log(`${mark}  ${r.label.padEnd(22)} ${r.status} via=${r.via.padEnd(11)} ${r.detail}`);
  console.log(`      ${r.url}`);
  if (expectCf && r.ok && r.via !== "cloudflare") {
    failed += 1;
    console.log(`FAIL  expected Cloudflare (cf-ray) on ${r.label}, got via=${r.via}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed (mode=${mode}${expectCf ? ", expect-cf" : ""}).`);
  process.exit(1);
}

console.log(`\nAll checks passed (mode=${mode}${expectCf ? ", expect-cf" : ""}).`);
