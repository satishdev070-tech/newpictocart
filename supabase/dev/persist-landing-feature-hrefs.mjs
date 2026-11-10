#!/usr/bin/env node
/**
 * One-shot: rewrite stored landing CMS mega-menu + Solutions hub hrefs to per-feature routes.
 *
 *   pnpm exec tsx --env-file=.env.local supabase/dev/persist-landing-feature-hrefs.mjs
 *   pnpm exec tsx --env-file=.env.local supabase/dev/persist-landing-feature-hrefs.mjs --dry-run
 *
 * Uses SUPABASE_SECRET_KEY against NEXT_PUBLIC_SUPABASE_URL (bypasses RLS via PostgREST).
 */
import { LANDING_KEY, parseLanding, validateLanding } from "../../src/features/marketing-site/landing.ts";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY");
    process.exit(1);
  }

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  const readRes = await fetch(`${url}/rest/v1/platform_settings?key=eq.${encodeURIComponent(LANDING_KEY)}&select=value`, { headers });
  if (!readRes.ok) {
    console.error("read failed", readRes.status, await readRes.text());
    process.exit(1);
  }
  const rows = await readRes.json();
  if (!rows?.[0]?.value) {
    console.log("No stored landing document — defaults already have feature hrefs. Nothing to do.");
    process.exit(0);
  }

  const raw = rows[0].value;
  const before = JSON.stringify({
    mega: raw?.header?.megaMenu,
    solutions: raw?.solutions?.items?.map((i) => [i.title, i.href]),
  });

  const parsed = validateLanding(parseLanding(raw));
  if (!parsed.ok) {
    console.error("validate failed", parsed.errors);
    process.exit(1);
  }

  const next = parsed.value;
  const after = JSON.stringify({
    mega: next.header.megaMenu,
    solutions: next.solutions.items.map((i) => [i.title, i.href]),
  });

  if (before === after) {
    console.log("Landing hrefs already normalized. Nothing to write.");
    process.exit(0);
  }

  console.log("Mega-menu / Solutions hrefs will be updated.");
  if (dryRun) {
    console.log(
      "dry-run mega sample",
      next.header.megaMenu.columns
        .flatMap((c) => c.items)
        .slice(0, 4)
        .map((i) => ({ title: i.title, href: i.href })),
    );
    process.exit(0);
  }

  const writeRes = await fetch(`${url}/rest/v1/platform_settings?on_conflict=key`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key: LANDING_KEY, value: next, updated_at: new Date().toISOString() }),
  });
  if (!writeRes.ok) {
    console.error("write failed", writeRes.status, await writeRes.text());
    process.exit(1);
  }
  console.log("Persisted normalized landing feature hrefs for", LANDING_KEY);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
