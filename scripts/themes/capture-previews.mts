/**
 * Captures a desktop and a phone screenshot of every marketplace theme on its demo store and
 * saves them as small WebP files in public/theme-previews/, plus the list of captured themes in
 * src/features/marketing-site/theme-previews.json. The marketing site then shows these static
 * images instead of loading live demo stores for every visitor (live demos load on click only).
 *
 *   pnpm themes:capture                       # all themes, demo stores on NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN
 *   pnpm themes:capture --root pictocart.in --only heritage-kashmir,luxury-indian
 *   pnpm themes:capture --root localhost --port 3000   # a local `pnpm dev` with the demo stores built
 *
 * Each theme is shot on its own demo store, or, when that store isn't up, on the next showcase
 * store that is (same order as the site's Live Preview: previewDemoCandidates). The demo stores
 * must exist first: `pnpm exec tsx --env-file=.env.local scripts/dev/showcase/run.mts <slug …>`
 * (see docs/THEME_MARKETPLACE.md). Needs a Chromium for Playwright
 * (`pnpm exec playwright install chromium` once, or CHROMIUM_PATH=/path/to/chrome). Commit the
 * output and deploy.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { MARKETPLACE_THEMES } from "../../src/features/theme/marketplace/catalog";
import { previewDemoCandidates } from "../../src/features/marketing-site/themes";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const root = arg("root") ?? process.env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN;
if (!root) throw new Error("Pass --root <platform root domain>, e.g. --root pictocart.in (or --root localhost --port 3000)");
const port = arg("port") ?? "3000";
const storeUrl = (slug: string, key: string) =>
  root === "localhost" ? `http://${slug}.localhost:${port}/?sf_theme=${encodeURIComponent(key)}` : `https://${slug}.${root}/?sf_theme=${encodeURIComponent(key)}`;
const only = new Set((arg("only") ?? "").split(",").filter(Boolean));
const outDir = resolve("public/theme-previews");
const manifestPath = resolve("src/features/marketing-site/theme-previews.json");

const DEVICES = {
  desktop: { viewport: { width: 1280, height: 800 }, scale: 1, outWidth: 960 },
  phone: { viewport: { width: 390, height: 844 }, scale: 2, outWidth: 390 },
} as const;

const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { desktop: string[]; phone: string[] };
await mkdir(outDir, { recursive: true });
// CHROMIUM_PATH: use an existing Chrome/Chromium instead of Playwright's download.
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const themes = MARKETPLACE_THEMES.filter((t) => only.size === 0 || only.has(t.key));
let ok = 0;

// Which demo stores are up (checked once each, lazily).
const up = new Map<string, boolean>();
async function isUp(slug: string): Promise<boolean> {
  if (!up.has(slug)) {
    const res = await fetch(storeUrl(slug, "exit"), { redirect: "follow", signal: AbortSignal.timeout(20_000) }).catch(() => null);
    up.set(slug, !!res?.ok);
  }
  return up.get(slug)!;
}
async function demoFor(t: (typeof themes)[number]): Promise<string | null> {
  for (const slug of previewDemoCandidates(t)) if (await isUp(slug)) return slug;
  return null;
}

for (const t of themes) {
  const demo = await demoFor(t);
  if (!demo) {
    console.warn(`✗ ${t.key}: no demo store is up (build one with scripts/dev/showcase/run.mts)`);
    continue;
  }
  const url = storeUrl(demo, t.key);
  for (const [device, cfg] of Object.entries(DEVICES) as [keyof typeof DEVICES, (typeof DEVICES)[keyof typeof DEVICES]][]) {
    const ctx = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: cfg.scale, isMobile: device === "phone", hasTouch: device === "phone" });
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
      // Hide the "Live preview of … theme" notice and pause carousels on their first slide.
      await page.addStyleTag({ content: `[data-sf-root] > div[role="status"]{display:none!important} *{animation-play-state:paused!important;transition:none!important}` });
      await page.waitForTimeout(1200);
      const png = await page.screenshot({ type: "png" });
      await sharp(png).resize({ width: cfg.outWidth }).webp({ quality: 72 }).toFile(`${outDir}/${t.key}-${device}.webp`);
      if (!manifest[device].includes(t.key)) manifest[device].push(t.key);
      ok++;
      console.log(`✓ ${t.key} (${device})`);
    } catch (err) {
      console.warn(`✗ ${t.key} (${device}): ${err instanceof Error ? err.message.split("\n")[0] : err}`);
    } finally {
      await ctx.close();
    }
  }
}
await browser.close();
manifest.desktop.sort();
manifest.phone.sort();
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\nSaved ${ok} screenshots for ${themes.length} themes to public/theme-previews/. Commit them with ${manifestPath.replace(process.cwd() + "/", "")}.`);
