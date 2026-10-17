import { z } from "zod";
import { INDUSTRY_SLUGS, isIndustry, type IndustrySlug } from "@/features/stores/industries";
import { STOCK_SLOTS } from "@/lib/unsplash-stock";
import { UNSPLASH_CATEGORIES } from "@/lib/unsplash-categories";
import { BUTTON_SHAPES, BUTTON_VARIANTS, CARD_RADII, CONTAINER_WIDTHS, FONT_KEYS, SPACING_SCALES, headerSettingsSchema, productCardSchema } from "../schema/tokens";
import { hexColor } from "../schema/primitives";
import { DEFAULT_THEME_CONFIG } from "../default-theme";
import { parseThemeConfigStrict } from "../schema/config";
import { applyThemePreset } from "../marketplace/apply";
import { THEME_STYLES, type HomeItem, type MarketplaceTheme, type ThemePreset, type ThemeStyle } from "../marketplace/types";
import { withLayout } from "../layouts/apply-layout";
import { SHOWCASE_STORES } from "../marketplace/showcase";
import { FOOTER_LAYOUTS, HEADER_STYLES, values } from "../sections/variants";
import { fieldSchema, isHomeSectionType, styleFieldsFor } from "./vocabulary";
import { SECTION_DEFINITIONS } from "../sections/definitions";
import { SECTION_TYPES, type SectionType } from "../sections/types";

/**
 * Theme documents made by the AI theme builder (pure; unit tested).
 *
 * 1. `aiThemeDraftSchema`: what we ask the model for. Lenient on purpose (unknown keys and bad
 *    values are repaired, not rejected), so a nearly-right answer isn't thrown away.
 * 2. `repairDraft()`: turns a draft into a complete ThemePreset: drops unknown section types and
 *    settings, replaces invalid values with defaults, clamps numbers, fixes colours and fonts,
 *    guarantees a hero and a product list, and fills unset layout variants from the category's
 *    layout personality. Every change is reported.
 * 3. `builtThemeSchema` + `validateBuiltTheme()`: the strict schema a stored marketplace theme must
 *    pass, plus the real check: applying it to a store config must give a valid ThemeConfig.
 */

/** AI drafts are cut to this many home sections; stored themes (incl. duplicates of built-ins) may have up to 24. */
export const MAX_HOME_SECTIONS = 14;
const MAX_STORED_SECTIONS = 24;

const looseItem = z.union([
  z.object({ type: z.string(), settings: z.record(z.string(), z.unknown()).optional().default({}) }).loose(),
  z.tuple([z.string(), z.record(z.string(), z.unknown())]).rest(z.unknown()),
]);

export const aiThemeDraftSchema = z.object({
  name: z.string().max(120).optional(),
  tagline: z.string().max(400).optional(),
  description: z.string().max(4000).optional(),
  style: z.string().max(40).optional(),
  bestFor: z.array(z.string().max(200)).max(20).optional(),
  features: z.array(z.string().max(200)).max(20).optional(),
  tokens: z.record(z.string(), z.unknown()).optional(),
  chrome: z.record(z.string(), z.unknown()).optional(),
  productCard: z.record(z.string(), z.unknown()).optional(),
  home: z.array(looseItem).min(1).max(40),
  notes: z.string().max(2000).optional(),
});
export type AiThemeDraft = z.infer<typeof aiThemeDraftSchema>;

// ---- Stored theme ------------------------------------------------------------------------------

const settingsRecord = z.record(z.string().max(40), z.union([z.string().max(40), z.number(), z.boolean()]));
const homeItemSchema = z.union([z.tuple([z.string(), settingsRecord]), z.tuple([z.string(), settingsRecord, z.string().regex(/^[a-z0-9-]{1,30}$/)])]);

/** Stored themes may use any section the home template accepts (AI drafts get the smaller HOME_SECTION_TYPES list). */
const allowedOnHome = (type: string): type is SectionType => (SECTION_TYPES as readonly string[]).includes(type) && (SECTION_DEFINITIONS[type as SectionType].groups as readonly string[]).includes("home");

/** Header defaults a theme may set (never the store's logo, menu or wordmark). */
const PRESET_HEADER = headerSettingsSchema.omit({ logoPath: true, logoAlt: true, menuHandle: true, wordmark: true, logoTagline: true }).partial().strict();

export const presetSchema = z
  .object({
    tokens: z
      .object({
        colors: z.object({ primary: hexColor, secondary: hexColor, accent: hexColor, background: hexColor, text: hexColor, border: hexColor, sale: hexColor }),
        headingFont: z.enum(FONT_KEYS),
        bodyFont: z.enum(FONT_KEYS),
        headingCase: z.enum(["normal", "uppercase"]),
        buttonShape: z.enum(BUTTON_SHAPES),
        buttonVariant: z.enum(BUTTON_VARIANTS),
        cardRadius: z.enum(CARD_RADII),
        containerWidth: z.enum(CONTAINER_WIDTHS),
        spacing: z.enum(SPACING_SCALES),
        sectionHeadingAlign: z.enum(["left", "center"]),
        finish: z.enum(["standard", "refined"]).optional(),
        imagery: z.enum(["auto", "off", ...UNSPLASH_CATEGORIES]).optional(),
      })
      .strict(),
    header: PRESET_HEADER,
    headerLayout: z.enum(["logo-left", "logo-center"]),
    productCard: productCardSchema.partial().strict(),
    footerTone: z.enum(["dark", "light", "muted"]),
    announcementTone: z.enum(["light", "dark", "accent", "muted"]),
    announcementMode: z.enum(["static", "rotate"]).optional(),
    inlineMenu: z.boolean(),
    menuStyle: z.enum(["bar", "drawer"]).optional(),
    footerDecor: z.enum(["none", "ethnic"]).optional(),
    hero: z.object({ align: z.enum(["left", "center", "right"]), textTone: z.enum(["light", "dark"]) }).strict(),
    headerStyle: z.enum(values(HEADER_STYLES)).optional(),
    footerLayout: z.enum(values(FOOTER_LAYOUTS)).optional(),
    family: z.enum(UNSPLASH_CATEGORIES).optional(),
    home: z.array(homeItemSchema).min(1).max(MAX_STORED_SECTIONS),
    collection: z.array(homeItemSchema).max(8).optional(),
    product: z.array(homeItemSchema).max(8).optional(),
  })
  .strict()
  .superRefine((p, ctx) => {
    p.home.forEach(([type, settings], i) => {
      if (!allowedOnHome(type)) return ctx.addIssue({ code: "custom", path: ["home", i, 0], message: `Unknown section type ${type}` });
      for (const [k, v] of Object.entries(settings)) {
        const f = fieldSchema(type, k);
        if (!f) ctx.addIssue({ code: "custom", path: ["home", i, 1, k], message: `${type} has no setting ${k}` });
        else if (!f.safeParse(v).success) ctx.addIssue({ code: "custom", path: ["home", i, 1, k], message: `Invalid value for ${type}.${k}` });
      }
    });
    if (!p.home.some(([t]) => t === "Hero")) ctx.addIssue({ code: "custom", path: ["home"], message: "A home page needs a Hero section" });
  });

const credit = z.object({ name: z.string().max(120), url: z.url().max(500) }).nullable();
export const themeImageSchema = z.object({
  id: z.string().regex(/^photo-[\w-]{4,80}$/),
  url: z.url().max(500).refine((u) => u.startsWith("https://images.unsplash.com/"), "Unsplash images only"),
  alt: z.string().max(300),
  photographer: credit,
  unsplashUrl: z.url().max(500),
  slot: z.enum(STOCK_SLOTS),
  category: z.enum(UNSPLASH_CATEGORIES),
  source: z.enum(["api", "fallback"]),
  /** Which home section (index) the photo fills, or null for a slot-wide pool photo. */
  section: z.number().int().min(0).max(40).nullable(),
});
export type ThemeImage = z.infer<typeof themeImageSchema>;

export const THEME_KEY_RE = /^[a-z0-9-]{2,40}$/;
const shortText = (max: number) => z.string().trim().max(max);

export const builtThemeSchema = z.object({
  key: z.string().regex(THEME_KEY_RE),
  name: z.string().trim().min(2).max(60),
  tagline: shortText(160),
  description: shortText(2000),
  industry: z.enum(INDUSTRY_SLUGS as [IndustrySlug, ...IndustrySlug[]]),
  style: z.enum(THEME_STYLES),
  bestFor: z.array(shortText(40).min(1)).max(6),
  features: z.array(shortText(60).min(1)).max(8),
  preset: presetSchema,
  images: z.array(themeImageSchema).max(40),
  reference: z.object({ url: z.url().max(500).nullable(), host: z.string().max(255).nullable(), screenshots: z.number().int().min(0).max(5) }),
  generation: z.object({ provider: z.string().max(20), model: z.string().max(100), attempts: z.number().int().min(1).max(6), repairs: z.array(z.string().max(200)).max(60), notes: z.string().max(600) }).nullable(),
});
export type BuiltTheme = z.infer<typeof builtThemeSchema>;

// ---- Repair ------------------------------------------------------------------------------------

const DEFAULT_COLORS = DEFAULT_THEME_CONFIG.tokens.colors;
const HEX = /^#[0-9a-f]{6}$/i;

function toHex(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (HEX.test(s)) return s;
  const short = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  const rgb = s.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/);
  if (rgb) return `#${[rgb[1], rgb[2], rgb[3]].map((x) => Math.min(255, Number(x)).toString(16).padStart(2, "0")).join("")}`;
  return null;
}

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T, repairs: string[], label: string): T {
  if (typeof v === "string" && (allowed as readonly string[]).includes(v)) return v as T;
  if (v !== undefined) repairs.push(`${label}: "${String(v).slice(0, 30)}" → ${fallback}`);
  return fallback;
}

const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : v === "true" ? true : v === "false" ? false : fallback);

/** Keeps only valid style settings of a section (invalid numbers are clamped, other bad values dropped). */
export function repairSettings(type: Parameters<typeof styleFieldsFor>[0], raw: Record<string, unknown>, repairs: string[], label: string): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    const f = styleFieldsFor(type).find((x) => x.key === k);
    if (!f) {
      repairs.push(`${label}: dropped unknown setting ${k}`);
      continue;
    }
    if (f.kind === "number") {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n)) {
        repairs.push(`${label}: dropped invalid ${k}`);
        continue;
      }
      const c = Math.round(Math.min(f.max, Math.max(f.min, n)));
      if (c !== n) repairs.push(`${label}: ${k} ${n} → ${c}`);
      out[k] = c;
    } else if (f.kind === "boolean") {
      if (typeof v === "boolean" || v === "true" || v === "false") out[k] = bool(v, false);
      else repairs.push(`${label}: dropped invalid ${k}`);
    } else if (typeof v === "string" && f.options.includes(v)) out[k] = v;
    else repairs.push(`${label}: dropped invalid ${k}=${String(v).slice(0, 30)}`);
  }
  return out;
}

export type RepairContext = { industry: IndustrySlug; name: string; index?: number };
export type RepairResult = { preset: ThemePreset; meta: { name: string; tagline: string; description: string; style: ThemeStyle; bestFor: string[]; features: string[]; notes: string }; repairs: string[] };

const cleanLine = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Draft → complete preset + listing metadata. Never throws for a schema-valid draft. */
export function repairDraft(draft: AiThemeDraft, ctx: RepairContext): RepairResult {
  const repairs: string[] = [];
  const t = draft.tokens ?? {};
  const rawColors = (t.colors && typeof t.colors === "object" ? t.colors : {}) as Record<string, unknown>;
  const colors = {} as Record<keyof typeof DEFAULT_COLORS, string>;
  for (const k of Object.keys(DEFAULT_COLORS) as (keyof typeof DEFAULT_COLORS)[]) {
    const hex = toHex(rawColors[k]);
    if (!hex) repairs.push(`colour ${k} missing or invalid → default`);
    colors[k] = hex ?? DEFAULT_COLORS[k];
  }
  const tokens: ThemePreset["tokens"] = {
    colors,
    headingFont: pick(t.headingFont, FONT_KEYS, "editorial-serif", repairs, "headingFont"),
    bodyFont: pick(t.bodyFont, FONT_KEYS, "modern-sans", repairs, "bodyFont"),
    headingCase: pick(t.headingCase, ["normal", "uppercase"] as const, "normal", repairs, "headingCase"),
    buttonShape: pick(t.buttonShape, BUTTON_SHAPES, "square", repairs, "buttonShape"),
    buttonVariant: pick(t.buttonVariant, BUTTON_VARIANTS, "solid", repairs, "buttonVariant"),
    cardRadius: pick(t.cardRadius, CARD_RADII, "none", repairs, "cardRadius"),
    containerWidth: pick(t.containerWidth, CONTAINER_WIDTHS, "wide", repairs, "containerWidth"),
    spacing: pick(t.spacing, SPACING_SCALES, "comfortable", repairs, "spacing"),
    sectionHeadingAlign: pick(t.sectionHeadingAlign, ["left", "center"] as const, "left", repairs, "sectionHeadingAlign"),
  };

  const c = draft.chrome ?? {};
  const headerLayout = pick(c.headerLayout, ["logo-left", "logo-center"] as const, "logo-left", repairs, "headerLayout");
  const menuStyle = pick(c.menuStyle, ["bar", "drawer"] as const, "bar", repairs, "menuStyle");
  const preset: ThemePreset = {
    tokens,
    header: { sticky: bool(c.sticky, true), showSearch: bool(c.showSearch, true), showWishlist: bool(c.showWishlist, true), showStoreName: true },
    headerLayout,
    inlineMenu: headerLayout === "logo-left" && menuStyle === "bar" ? bool(c.inlineMenu, true) : false,
    menuStyle,
    announcementTone: pick(c.announcementTone, ["light", "dark", "accent", "muted"] as const, "dark", repairs, "announcementTone"),
    announcementMode: pick(c.announcementMode, ["static", "rotate"] as const, "static", repairs, "announcementMode"),
    footerTone: pick(c.footerTone, ["dark", "light", "muted"] as const, "dark", repairs, "footerTone"),
    hero: { align: pick(c.heroAlign, ["left", "center", "right"] as const, "left", repairs, "heroAlign"), textTone: pick(c.heroTextTone, ["light", "dark"] as const, "light", repairs, "heroTextTone") },
    productCard: {},
    home: [],
  };
  const hs = c.headerStyle === undefined ? undefined : pick(c.headerStyle, values(HEADER_STYLES), "classic", repairs, "headerStyle");
  if (hs) preset.headerStyle = hs;
  const fl = c.footerLayout === undefined ? undefined : pick(c.footerLayout, values(FOOTER_LAYOUTS), "columns", repairs, "footerLayout");
  if (fl) preset.footerLayout = fl;

  const pc = productCardSchema.omit({ offerBadge: true }).partial().shape;
  for (const [k, v] of Object.entries(draft.productCard ?? {})) {
    const s = (pc as Record<string, z.ZodType>)[k];
    if (s && s.safeParse(v).success && v !== undefined) (preset.productCard as Record<string, unknown>)[k] = v;
    else repairs.push(`productCard: dropped ${k}`);
  }

  const home: HomeItem[] = [];
  for (const [i, raw] of draft.home.entries()) {
    const [type, settings] = Array.isArray(raw) ? [raw[0], raw[1]] : [raw.type, raw.settings];
    if (!isHomeSectionType(type)) {
      repairs.push(`home[${i}]: dropped unknown section ${String(type).slice(0, 30)}`);
      continue;
    }
    if (home.length >= MAX_HOME_SECTIONS) {
      repairs.push(`home: kept the first ${MAX_HOME_SECTIONS} sections`);
      break;
    }
    home.push([type, repairSettings(type, settings as Record<string, unknown>, repairs, `home[${i}] ${type}`)]);
  }
  const heroAt = home.findIndex(([ty]) => ty === "Hero");
  if (heroAt < 0) {
    home.unshift(["Hero", { height: "large" }]);
    repairs.push("home: added a Hero");
  } else if (heroAt > 2) {
    home.unshift(home.splice(heroAt, 1)[0]!);
    repairs.push("home: moved the Hero to the top");
  }
  if (!home.some(([ty]) => ["ProductGrid", "ProductCarousel", "Bestseller", "NewArrivals", "CompactProducts", "ProductSpotlight"].includes(ty))) {
    home.splice(Math.min(2, home.length), 0, ["ProductGrid", { limit: 8, columns: 4 }]);
    repairs.push("home: added a product grid");
  }
  preset.home = home;

  // Unset variants come from the category's layout personality (same as built-in themes).
  const full = withLayout(preset, ctx.industry, ctx.index ?? 0);
  const styleName = (draft.style ?? "").toLowerCase();
  const meta = {
    name: cleanLine(ctx.name, 60) || cleanLine(draft.name, 60) || "Custom theme",
    tagline: cleanLine(draft.tagline, 160),
    description: cleanLine(draft.description, 2000),
    style: (THEME_STYLES as readonly string[]).includes(styleName) ? (styleName as ThemeStyle) : "modern",
    bestFor: (draft.bestFor ?? []).map((x) => cleanLine(x, 40)).filter(Boolean).slice(0, 6),
    features: (draft.features ?? []).map((x) => cleanLine(x, 60)).filter(Boolean).slice(0, 8),
    notes: cleanLine(draft.notes, 600),
  };
  if (draft.style && meta.style !== styleName) repairs.push(`style "${draft.style.slice(0, 20)}" → modern`);
  return { preset: full, meta, repairs };
}

// ---- Validation --------------------------------------------------------------------------------

export type ValidationResult = { ok: true; theme: BuiltTheme } | { ok: false; issues: string[] };

/** Strict schema + "applies cleanly to a store" check. */
export function validateBuiltTheme(raw: unknown): ValidationResult {
  const parsed = builtThemeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues.slice(0, 12).map((i) => `${i.path.join(".") || "theme"}: ${i.message}`) };
  const applied = parseThemeConfigStrict(applyThemePreset(DEFAULT_THEME_CONFIG, parsed.data.preset as ThemePreset));
  if (!applied.ok) return { ok: false, issues: applied.issues.slice(0, 12).map((i) => `config ${i.path}: ${i.message}`) };
  return { ok: true, theme: parsed.data };
}

/** URL-safe key from a name, never colliding with `taken` (built-in and stored keys). */
export function themeKeyFor(name: string, taken: (key: string) => boolean, suffix = () => Math.random().toString(36).slice(2, 6)): string {
  const base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "theme";
  const first = base.length >= 2 ? base : `${base}-theme`;
  if (!taken(first)) return first;
  for (let i = 0; i < 20; i++) {
    const k = `${base.slice(0, 34)}-${suffix()}`;
    if (!taken(k)) return k;
  }
  return `custom-${Date.now().toString(36)}`;
}

/** Showcase demo store for Live Preview of a custom theme: its industry's, else the general store. */
export function demoFor(industry: string): string {
  return Object.entries(SHOWCASE_STORES).find(([, s]) => s.industry === industry)?.[0] ?? "sabkuch";
}

/** Stored theme → marketplace catalogue entry (what sellers browse and apply). */
export function toMarketplaceTheme(t: BuiltTheme, added: string): MarketplaceTheme {
  return {
    key: t.key,
    name: t.name,
    tagline: t.tagline,
    description: t.description,
    industry: t.industry,
    style: t.style,
    bestFor: t.bestFor,
    features: t.features,
    demo: demoFor(t.industry),
    version: "1.0.0",
    added,
    preset: t.preset as ThemePreset,
  };
}

export const industryOrGeneral = (v: string): IndustrySlug => (isIndustry(v) ? v : "general");

/**
 * A built-in (code) preset as a stored-theme preset: missing tokens are completed from the default
 * theme, and header / product-card keys a marketplace theme may not set are dropped. Used by
 * "Duplicate", so a copy of any catalogue theme passes `presetSchema`.
 */
export function normalizePreset(preset: ThemePreset): ThemePreset {
  const d = DEFAULT_THEME_CONFIG.tokens;
  const t = preset.tokens as Record<string, unknown>;
  const tokens = {
    colors: { ...d.colors, ...preset.tokens.colors },
    headingFont: preset.tokens.headingFont,
    bodyFont: preset.tokens.bodyFont,
    headingCase: (t.headingCase as string) ?? d.headingCase,
    buttonShape: (t.buttonShape as string) ?? d.buttonShape,
    buttonVariant: (t.buttonVariant as string) ?? d.buttonVariant,
    cardRadius: (t.cardRadius as string) ?? d.cardRadius,
    containerWidth: (t.containerWidth as string) ?? d.containerWidth,
    spacing: (t.spacing as string) ?? d.spacing,
    sectionHeadingAlign: (t.sectionHeadingAlign as string) ?? d.sectionHeadingAlign,
    ...(t.finish ? { finish: t.finish } : {}),
    ...(t.imagery ? { imagery: t.imagery } : {}),
  };
  const headerKeys = Object.keys(PRESET_HEADER.shape);
  const cardKeys = Object.keys(productCardSchema.shape);
  const keep = (o: Record<string, unknown>, keys: string[]) => Object.fromEntries(Object.entries(o ?? {}).filter(([k]) => keys.includes(k)));
  return { ...preset, tokens: tokens as ThemePreset["tokens"], header: keep(preset.header, headerKeys), productCard: keep(preset.productCard, cardKeys) };
}
