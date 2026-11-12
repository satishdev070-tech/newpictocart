/**
 * Informative themes: visual snapshots + onboarding thumbnails (docs/informative/PLAN.md, M3).
 *
 *   FEATURE_INFORMATIVE_WEBSITE=all pnpm dev --port 3012        # in another terminal
 *   pnpm informative:shots [--base http://localhost:3012] [--out .shots/informative] [--no-thumbs]
 *
 * For every theme in the registry it captures the preview page full-length at 360 / 768 / 1280 px
 * (visual review / regression: compare two runs' folders) and writes a 640×400 WebP thumbnail of the
 * 1280 px first screen to public/informative/themes/<id>.webp (committed; used by onboarding).
 * Set CHROMIUM_PATH to use an installed Chrome when Playwright's browsers are not downloaded.
 */
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { INFORMATIVE_THEMES } from "../../src/features/informative/themes/registry";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const base = (arg("base") ?? "http://localhost:3012").replace(/\/$/, "");
const outDir = resolve(arg("out") ?? ".shots/informative");
const thumbs = !process.argv.includes("--no-thumbs");
const thumbDir = resolve("public/informative/themes");
const WIDTHS = [360, 768, 1280] as const;

await mkdir(outDir, { recursive: true });
if (thumbs) await mkdir(thumbDir, { recursive: true });

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  for (const theme of INFORMATIVE_THEMES) {
    for (const width of WIDTHS) {
      const page = await browser.newPage({ viewport: { width, height: width === 360 ? 780 : 900 }, reducedMotion: "reduce" });
      const res = await page.goto(`${base}/informative/preview/${theme.id}`, { waitUntil: "networkidle" });
      if (!res || res.status() !== 200) throw new Error(`${theme.id}@${width}: HTTP ${res?.status()} (is the flag on?)`);
      // Lazy images below the fold: scroll through once so they load before the full-page capture.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 120));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: `${outDir}/${theme.id}-${width}.png`, fullPage: true });
      if (thumbs && width === 1280) {
        const first = await page.screenshot({ clip: { x: 0, y: 0, width: 1280, height: 800 } });
        await sharp(first).resize(640, 400).webp({ quality: 72 }).toFile(`${thumbDir}/${theme.id}.webp`);
      }
      await page.close();
      console.log(`✓ ${theme.id} @ ${width}`);
    }
  }
} finally {
  await browser.close();
}
console.log(`Snapshots: ${outDir}${thumbs ? `\nThumbnails: ${thumbDir}` : ""}`);
