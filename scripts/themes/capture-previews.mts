/**
 * Captures a desktop and a phone screenshot of every marketplace theme on its demo store and
 * saves them as small WebP files in public/theme-previews/, plus the list of captured themes in
 * src/features/marketing-site/theme-previews.json. The marketing site then shows these static
 * images instead of loading live demo stores for every visitor (live demos load on click only).
 *
 *   pnpm themes:capture                       # all themes, demo stores on NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN
 *   pnpm themes:capture --root pictocart.in --only heritage-kashmir,luxury-indian
 *   pnpm themes:capture --root localhost --port 3000   # a local `pnpm dev` with the demo stores built
 *   pnpm themes:capture --root localhost --home       # only the themes the home page shows (hero + showcase)
 *
 * Each theme is shot on its own demo store, or, when that store isn't up, on the next showcase
 * store that is (same order as the site's Live Preview: previewDemoCandidates). The demo stores
 * are built with `pnpm exec tsx --env-file=.env.local scripts/dev/showcase/run.mts <slug …>`
 * (see docs/THEME_MARKETPLACE.md). When no demo store is up (or with --sample), the theme is shot
 * on the platform's own preview page (/themes/<key>/preview: the sample store drawn from the
 * theme's preset), shown full-window at the device size.
 *
 * Output per theme: <key>-desktop.webp (1440×900 shot, 1200 px wide), <key>-desktop-640.webp
 * (card size) and <key>-phone.webp (390×844 at 2×, 390 px wide). Needs a Chromium for Playwright
 * (`pnpm exec playwright install chromium` once, or CHROMIUM_PATH=/path/to/chrome). Commit the
 * output and deploy.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { MARKETPLACE_THEMES } from "../../src/features/theme/marketplace/catalog";
import { previewDemoCandidates, SHOWCASE_INDUSTRIES, showcaseThemes } from "../../src/features/marketing-site/themes";
import { HERO_WORD_RULES, heroThemeCandidates } from "../../src/features/marketing-site/hero-themes";
import { DEFAULT_LANDING } from "../../src/features/marketing-site/landing";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const root = arg("root") ?? process.env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN;
if (!root) throw new Error("Pass --root <platform root domain>, e.g. --root pictocart.in (or --root localhost --port 3000)");
const port = arg("port") ?? "3000";
const storeUrl = (slug: string, key: string) =>
  root === "localhost" ? `http://${slug}.localhost:${port}/?sf_theme=${encodeURIComponent(key)}` : `https://${slug}.${root}/?sf_theme=${encodeURIComponent(key)}`;
const platformUrl = (path: string) => (root === "localhost" ? `http://localhost:${port}${path}` : `https://${root}${path}`);
const only = new Set((arg("only") ?? "").split(",").filter(Boolean));
const forceSample = process.argv.includes("--sample");
if (process.argv.includes("--home")) {
  // Home page: the showcase row, every theme the hero can pair with a headline word, and the
  // first theme of each hero industry (so a CMS word change still finds a screenshot).
  const all = MARKETPLACE_THEMES;
  for (const t of showcaseThemes(SHOWCASE_INDUSTRIES)) only.add(t.key);
  for (const t of heroThemeCandidates(DEFAULT_LANDING.hero.rotatingWords, all)) only.add(t.key);
  for (const r of HERO_WORD_RULES) {
    for (const k of r.prefer ?? []) only.add(k);
    const first = all.find((t) => t.industry === r.industry);
    if (first) only.add(first.key);
  }
}
const outDir = resolve("public/theme-previews");
const manifestPath = resolve("src/features/marketing-site/theme-previews.json");

const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 }, scale: 1, out: [{ width: 1200, suffix: "" }, { width: 640, suffix: "-640" }] },
  phone: { viewport: { width: 390, height: 844 }, scale: 2, out: [{ width: 390, suffix: "" }] },
} as const;

const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { desktop: string[]; phone: string[]; desktopSmall?: string[] };
manifest.desktopSmall ??= [];
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
  const demo = forceSample ? null : await demoFor(t);
  const url = demo ? storeUrl(demo, t.key) : platformUrl(`/themes/${t.key}/preview`);
  console.log(`… ${t.key} on ${demo ? `demo store ${demo}` : "the sample preview page"}`);
  for (const [device, cfg] of Object.entries(DEVICES) as [keyof typeof DEVICES, (typeof DEVICES)[keyof typeof DEVICES]][]) {
    const ctx = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: cfg.scale, isMobile: device === "phone", hasTouch: device === "phone" });
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
      if (!demo) {
        // Show only the sample store, full-window, so it lays out at the real device width.
        const found = await page.evaluate(() => {
          const el = document.querySelector<HTMLElement>('[aria-label^="Sample store in the"]');
          if (!el) return false;
          document.body.replaceChildren(el);
          document.body.style.cssText = "margin:0;background:#fff;overflow:hidden";
          el.style.minHeight = "100vh";
          window.scrollTo(0, 0);
          return true;
        });
        if (!found) throw new Error("no sample store on the preview page");
        await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 30_000 }).catch(() => {});
      }
      // Hide the "Live preview of … theme" notice and pause carousels on their first slide.
      await page.addStyleTag({ content: `[data-sf-root] > div[role="status"]{display:none!important} *{animation-play-state:paused!important;transition:none!important}` });
      await page.waitForTimeout(1200);
      const png = await page.screenshot({ type: "png" });
      for (const o of cfg.out) await sharp(png).resize({ width: o.width }).webp({ quality: 70, effort: 6 }).toFile(`${outDir}/${t.key}-${device}${o.suffix}.webp`);
      if (!manifest[device].includes(t.key)) manifest[device].push(t.key);
      if (device === "desktop" && !manifest.desktopSmall!.includes(t.key)) manifest.desktopSmall!.push(t.key);
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
manifest.desktopSmall!.sort();
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\nSaved ${ok} screenshots for ${themes.length} themes to public/theme-previews/. Commit them with ${manifestPath.replace(process.cwd() + "/", "")}.`);
