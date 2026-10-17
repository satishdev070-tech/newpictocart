/**
 * Runs the AI theme builder pipeline once, outside the app (no database writes):
 * Add --no-ai to skip the model call (draft derived from the page summary).
 *   pnpm exec tsx --conditions=react-server --env-file=.env.local scripts/dev/theme-builder/run.mts <https-url> <industry> "<name>" [screenshot.png ...] [--out file.json]
 * Uses the platform's AI providers (Admin → Social apps credentials, else *_API_KEY env) and
 * UNSPLASH_ACCESS_KEY when set. Prints a summary and writes the theme document as JSON.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { safeFetchText } from "@/features/theme/builder/fetch-guard";
import { buildThemeFromReference } from "@/features/theme/builder/pipeline";
import { generateJson, resolveModel, type ProviderConfig } from "@/features/neural-pulse/server/llm";
import { AI_PROVIDERS, resolveCredential } from "@/features/platform-apps/core";
import { decryptSecret } from "@/lib/crypto";
import { serverEnv } from "@/lib/env/server";
import { getStockImages } from "@/lib/unsplash";
import { isIndustry } from "@/features/stores/industries";
import { layoutSummary } from "@/features/theme/layouts/apply-layout";
import type { ThemePreset } from "@/features/theme/marketplace/types";

const args = process.argv.slice(2);
// --no-ai: no AI key available; the draft is derived from the page summary by a simple heuristic
// (exercises fetch → extract → repair → validation → Unsplash fill without the model call).
const noAi = args.includes("--no-ai");
if (noAi) args.splice(args.indexOf("--no-ai"), 1);
const outAt = args.indexOf("--out");
const out = outAt >= 0 ? args.splice(outAt, 2)[1]! : "theme-builder-output.json";
const [url, industry = "fashion", name = "Reference Theme", ...shots] = args;
if (!url || !isIndustry(industry)) throw new Error("usage: run.mts <https-url|-> <industry> <name> [screenshots...]");

// Same providers as the app (platform credentials in the database, else *_API_KEY env), vision-capable first.
// (Read-only service query: the script runs outside Next, so it can't use the app's server modules.)
const configured: ProviderConfig[] = [];
for (const id of AI_PROVIDERS) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/platform_app_credentials?select=client_id,secret_ciphertext,extra&provider=eq.${id}`, { headers: { apikey: process.env.SUPABASE_SECRET_KEY!, authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}` } });
  const data = res.ok ? (((await res.json()) as Parameters<typeof resolveCredential>[1][])[0] ?? null) : null;
  const cred = resolveCredential(id, data, (ct) => decryptSecret(ct, "platform-app-credentials"), serverEnv());
  if (cred?.secret) configured.push({ id, apiKey: cred.secret, model: resolveModel(id, cred.extra.model) });
}
const vision = (p: ProviderConfig) => p.id === "anthropic" || p.id === "gemini";
const providers = [...configured.filter(vision), ...configured.filter((p) => !vision(p))];
console.error(`providers: ${providers.map((p) => `${p.id}/${p.model}`).join(", ") || "none"}`);
const screenshots = shots.map((p) => ({ mediaType: (p.endsWith(".png") ? "image/png" : p.endsWith(".webp") ? "image/webp" : "image/jpeg") as "image/png", data: readFileSync(p).toString("base64") }));

const t0 = Date.now();
const { theme, summary } = await buildThemeFromReference(
  { name, industry, url: url === "-" ? null : url, screenshots },
  {
    fetchText: (u, o) => safeFetchText(u, o),
    generate: async (prompt, schema) => {
      if (noAi) return { data: schema.parse(heuristicDraft(prompt.user)), provider: "heuristic", model: "no-ai", attempts: 1 };
      const r = await generateJson(providers, prompt, schema);
      return { data: r.data, provider: r.provider, model: r.model, attempts: r.attempts };
    },
    fetchStock: (c, s, n) => getStockImages(c, s, n),
  },
);
writeFileSync(out, JSON.stringify({ summary, theme }, null, 2));
console.log(JSON.stringify({ ms: Date.now() - t0, summary: summary && { host: summary.host, colors: summary.colors.slice(0, 6), fonts: summary.fonts, fontKeys: summary.fontKeys, header: summary.header, sections: summary.sections }, name: theme.name, tagline: theme.tagline, style: theme.style, tokens: theme.preset.tokens, chrome: { headerLayout: theme.preset.headerLayout, headerStyle: theme.preset.headerStyle, footerLayout: theme.preset.footerLayout, menuStyle: theme.preset.menuStyle }, layout: layoutSummary(theme.preset as ThemePreset), home: theme.preset.home.map(([t, s]) => `${t} ${JSON.stringify(s)}`), images: theme.images.length, credits: [...new Set(theme.images.map((i) => i.photographer?.name))].slice(0, 6), generation: theme.generation }, null, 2));

/** --no-ai stand-in: reads the reference summary back out of the prompt and maps it to a draft. */
function heuristicDraft(user: string) {
  const colors = [...(user.match(/Most used colours[^\n]*/)?.[0].matchAll(/#[0-9a-f]{6}/g) ?? [])].map((m) => m[0]);
  const lum = (h: string) => [1, 3, 5].reduce((a, i, n) => a + parseInt(h.slice(i, i + 2), 16) * [0.2126, 0.7152, 0.0722][n]!, 0) / 255;
  const light = colors.filter((c) => lum(c) > 0.85);
  const dark = colors.filter((c) => lum(c) < 0.3);
  const mid = colors.filter((c) => lum(c) >= 0.3 && lum(c) <= 0.85);
  const fonts = user.match(/nearest allowed font keys: ([^\n]*)/)?.[1]?.split(", ").filter((f) => f !== "none") ?? [];
  const sections = user.match(/Section order detected: ([^\n]*)/)?.[1]?.split(" → ") ?? [];
  const map: Record<string, [string, Record<string, unknown>]> = {
    hero: ["Hero", { variant: "overlay", height: "large" }],
    "category tiles": ["CategoryGrid", { variant: "rail" }],
    "product grid": ["ProductGrid", { variant: "grid", columns: 4 }],
    "image + text story": ["EditorialImageText", { variant: "split" }],
    testimonials: ["Testimonials", { variant: "spotlight" }],
    newsletter: ["Newsletter", { variant: "split" }],
    "brand logos strip": ["BrandStrip", {}],
    "trust / USP icons": ["TrustBadges", { layout: "line" }],
    "lookbook gallery": ["Lookbook", {}],
    "sale / offer banner": ["PromoBanner", {}],
    "social / UGC strip": ["SocialProof", {}],
    faq: ["FAQ", {}],
  };
  const home = [...new Set(sections)].flatMap((k) => (map[k] ? [{ type: map[k]![0], settings: map[k]![1] }] : []));
  return {
    tagline: "Clean, product-first and calm",
    description: "Recreated from the reference's colours, type and section rhythm.",
    style: "modern",
    bestFor: ["Everyday essentials"],
    features: home.slice(0, 4).map((h) => h.type),
    tokens: { colors: { primary: dark[0] ?? "#111111", text: dark[0] ?? "#111111", background: light[0] ?? "#ffffff", border: light[1] ?? "#e5e5e5", accent: mid[0] ?? dark[1] ?? "#333333", secondary: mid[1] ?? dark[1] ?? "#444444", sale: "#b42318" }, headingFont: fonts[0], bodyFont: fonts[1] ?? fonts[0], buttonShape: /pill buttons/.test(user) ? "pill" : "rounded" },
    chrome: { headerLayout: /logo center/.test(user) ? "logo-center" : "logo-left", sticky: / sticky,/.test(user) },
    home: home.length ? home : [{ type: "Hero", settings: {} }],
    notes: "Heuristic draft (no AI).",
  };
}
