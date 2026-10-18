import { z } from "zod";
import { SECTION_DEFINITIONS, getSectionDefinition } from "../sections/definitions";
import { SECTION_TYPES, type SectionGroup, type SectionInstance, type SectionType } from "../sections/types";
import { HEX_COLOR_RE, SECTION_ID_RE, STORAGE_PATH_RE } from "./primitives";
import { headerSettingsSchema, productCardSchema, tokensSchema, type HeaderSettings, type ProductCardSettings, type ThemeTokens } from "./tokens";
import { themeMenusSchema, type ThemeMenu } from "./links";
import { MAX_POPUPS, MAX_THEME_PAGES, RESERVED_PAGE_HANDLES, builtinTitlesSchema, embedsSchema, pageMetaSchema, popupSchema, type BuiltinTitles, type Embeds, type PageMeta, type Popup } from "./site";

/**
 * Theme config = the JSON stored in theme_versions.config.
 *
 *   { schemaVersion, tokens, header, productCard,
 *     layout:    { header: Section[], footer: Section[] },      rendered by store/[host]/layout.tsx
 *     templates: { home, collection, product,                  original three
 *                  collectionList, page, blog, search, cart, account },   site builder (default [])
 *     pages:     [{ id, handle, title, seo…, sections }],      site-builder pages at /pages/<handle>
 *     popups:    Popup[], menus: { [handle]: ThemeMenu }, embeds }
 *
 * Every site-builder key defaults to "nothing", so themes saved before it render unchanged.
 *
 * Two parsers:
 *  - parseThemeConfigStrict(): used on SAVE. Any invalid section -> VALIDATION error with a path.
 *  - resolveThemeConfig():     used on RENDER. Never throws; invalid parts fall back per section.
 */

export const THEME_SCHEMA_VERSION = 1;
export const MAX_SECTIONS_PER_GROUP = 40;
export const MAX_CONFIG_BYTES = 256 * 1024;

export const TEMPLATE_KEYS = ["home", "collection", "product", "collectionList", "page", "blog", "search", "cart", "account"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];
export const LAYOUT_KEYS = ["header", "footer"] as const;
export type LayoutKey = (typeof LAYOUT_KEYS)[number];

export const visibilitySchema = z.object({ desktop: z.boolean().default(true), mobile: z.boolean().default(true) });

/** Envelope only; settings are validated against the section's own schema afterwards. */
const styleColor = z.string().trim().refine((v) => v === "" || HEX_COLOR_RE.test(v), "Use a colour like #1c1917").transform((v) => v.toLowerCase()).default("");
const sectionStyleSchema = z.object({ background: styleColor, text: styleColor, accent: styleColor }).prefault({});

const sectionEnvelope = z.object({
  id: z.string().regex(SECTION_ID_RE, "Invalid section id"),
  type: z.enum(SECTION_TYPES),
  settings: z.record(z.string(), z.unknown()).default({}),
  visibility: visibilitySchema.prefault({}),
  style: sectionStyleSchema.optional(),
});

export type ThemePage = PageMeta & { sections: SectionInstance[] };

export type ThemeConfig = {
  schemaVersion: number;
  tokens: ThemeTokens;
  header: HeaderSettings;
  productCard: ProductCardSettings;
  layout: Record<LayoutKey, SectionInstance[]>;
  templates: Record<TemplateKey, SectionInstance[]>;
  pages: ThemePage[];
  popups: Popup[];
  /** Theme copies of menus by handle; they replace the database menu with the same handle. */
  menus: Record<string, ThemeMenu>;
  embeds: Embeds;
  /** Site-builder page shown at "/" instead of templates.home ("" = the home template). */
  homePageId: string;
  /** Renamed built-in pages (blog, contact, FAQ); empty = default titles. */
  builtinTitles: BuiltinTitles;
};

export type ThemeIssue = { path: string; message: string };

/** Site-builder templates and pages: anything allowed on the home page (+ the PageContent marker on templates). */
const HOME_LIKE: readonly SectionGroup[] = ["collectionList", "page", "blog", "search", "cart", "account", "custom"];

export function groupAllows(type: SectionType, group: SectionGroup): boolean {
  const groups = SECTION_DEFINITIONS[type].groups as readonly SectionGroup[];
  if (groups.includes(group)) return true;
  if (!HOME_LIKE.includes(group)) return false;
  if (type === "PageContent") return group !== "custom";
  return groups.includes("home");
}

function formatIssues(prefix: string, error: z.ZodError): ThemeIssue[] {
  return error.issues.map((i) => ({ path: [prefix, ...i.path.map(String)].filter(Boolean).join("."), message: i.message }));
}

function parseSectionList(raw: unknown, group: SectionGroup, path: string, issues: ThemeIssue[]): SectionInstance[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    issues.push({ path, message: "Expected a list of sections" });
    return [];
  }
  if (raw.length > MAX_SECTIONS_PER_GROUP) issues.push({ path, message: `At most ${MAX_SECTIONS_PER_GROUP} sections` });
  const out: SectionInstance[] = [];
  const seenIds = new Set<string>();
  const seenSingletons = new Set<string>();
  raw.slice(0, MAX_SECTIONS_PER_GROUP).forEach((item, index) => {
    const at = `${path}.${index}`;
    const env = sectionEnvelope.safeParse(item);
    if (!env.success) {
      issues.push(...formatIssues(at, env.error));
      return;
    }
    const { id, type, settings, visibility } = env.data;
    const def = getSectionDefinition(type)!;
    if (!groupAllows(type, group)) {
      issues.push({ path: at, message: `${def.label} can't be placed in ${group}` });
      return;
    }
    if (seenIds.has(id)) {
      issues.push({ path: `${at}.id`, message: "Duplicate section id" });
      return;
    }
    if (def.singleton && seenSingletons.has(type)) {
      issues.push({ path: at, message: `Only one ${def.label} is allowed here` });
      return;
    }
    const parsed = def.schema.safeParse(settings);
    if (!parsed.success) {
      issues.push(...formatIssues(`${at}.settings`, parsed.error).map((i) => ({ ...i, message: `${def.label}: ${i.message}` })));
      return; // render: skip just this section; save: the issue fails the whole save
    }
    seenIds.add(id);
    if (def.singleton) seenSingletons.add(type);
    const style = env.data.style && (env.data.style.background || env.data.style.text || env.data.style.accent) ? env.data.style : undefined;
    out.push({ id, type, settings: parsed.data as Record<string, unknown>, visibility, ...(style ? { style } : {}) });
  });
  return out;
}

function parsePages(raw: unknown, issues: ThemeIssue[]): ThemePage[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    issues.push({ path: "pages", message: "Expected a list of pages" });
    return [];
  }
  if (raw.length > MAX_THEME_PAGES) issues.push({ path: "pages", message: `At most ${MAX_THEME_PAGES} pages` });
  const out: ThemePage[] = [];
  const handles = new Set<string>();
  const ids = new Set<string>();
  raw.slice(0, MAX_THEME_PAGES).forEach((item, index) => {
    const at = `pages.${index}`;
    const meta = pageMetaSchema.safeParse(item);
    if (!meta.success) {
      issues.push(...formatIssues(at, meta.error));
      return;
    }
    if (RESERVED_PAGE_HANDLES.has(meta.data.handle) || handles.has(meta.data.handle)) {
      issues.push({ path: `${at}.handle`, message: "Another page already uses this address" });
      return;
    }
    if (ids.has(meta.data.id)) {
      issues.push({ path: `${at}.id`, message: "Duplicate page id" });
      return;
    }
    handles.add(meta.data.handle);
    ids.add(meta.data.id);
    const sections = parseSectionList((item as { sections?: unknown }).sections, "custom", `${at}.sections`, issues);
    out.push({ ...meta.data, sections });
  });
  return out;
}

function parsePopups(raw: unknown, issues: ThemeIssue[]): Popup[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    issues.push({ path: "popups", message: "Expected a list of popups" });
    return [];
  }
  const out: Popup[] = [];
  const ids = new Set<string>();
  raw.slice(0, MAX_POPUPS).forEach((item, index) => {
    const r = popupSchema.safeParse(item);
    if (!r.success) return void issues.push(...formatIssues(`popups.${index}`, r.error));
    if (ids.has(r.data.id)) return void issues.push({ path: `popups.${index}.id`, message: "Duplicate popup id" });
    ids.add(r.data.id);
    out.push(r.data);
  });
  if (raw.length > MAX_POPUPS) issues.push({ path: "popups", message: `At most ${MAX_POPUPS} popups` });
  return out;
}

function parseObject<S extends z.ZodType>(schema: S, raw: unknown, path: string, issues: ThemeIssue[]): z.infer<S> {
  const r = schema.safeParse(raw ?? {});
  if (r.success) return r.data;
  issues.push(...formatIssues(path, r.error));
  return schema.parse({});
}

function parseAll(raw: unknown): { config: ThemeConfig; issues: ThemeIssue[] } {
  const issues: ThemeIssue[] = [];
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  if (raw !== undefined && obj !== raw) issues.push({ path: "", message: "Theme config must be an object" });
  const layoutRaw = (obj.layout && typeof obj.layout === "object" ? obj.layout : {}) as Record<string, unknown>;
  const templatesRaw = (obj.templates && typeof obj.templates === "object" ? obj.templates : {}) as Record<string, unknown>;
  const templates = Object.fromEntries(TEMPLATE_KEYS.map((k) => [k, parseSectionList(templatesRaw[k], k, `templates.${k}`, issues)])) as Record<TemplateKey, SectionInstance[]>;
  const header = parseSectionList(layoutRaw.header, "header", "layout.header", issues);
  const footer = parseSectionList(layoutRaw.footer, "footer", "layout.footer", issues);
  const config: ThemeConfig = {
    schemaVersion: THEME_SCHEMA_VERSION,
    tokens: parseObject(tokensSchema, obj.tokens, "tokens", issues),
    header: parseObject(headerSettingsSchema, obj.header, "header", issues),
    productCard: parseObject(productCardSchema, obj.productCard, "productCard", issues),
    layout: { header, footer },
    templates,
    pages: [],
    popups: parsePopups(obj.popups, issues),
    menus: parseObject(themeMenusSchema, obj.menus, "menus", issues),
    embeds: parseObject(embedsSchema, obj.embeds, "embeds", issues),
    homePageId: "",
    builtinTitles: parseObject(builtinTitlesSchema, obj.builtinTitles, "builtinTitles", issues),
  };
  config.pages = parsePages(obj.pages, issues);
  // A homepage that no longer exists (deleted page, bad value) falls back to the home template.
  config.homePageId = typeof obj.homePageId === "string" && config.pages.some((p) => p.id === obj.homePageId) ? obj.homePageId : "";
  return { config, issues };
}

/** Render-time parse: never throws; invalid tokens fall back to defaults, invalid sections are skipped. */
export function resolveThemeConfig(raw: unknown): { config: ThemeConfig; issues: ThemeIssue[] } {
  return parseAll(raw);
}

/** Save-time parse: returns the normalised config or the list of issues. */
export function parseThemeConfigStrict(raw: unknown): { ok: true; config: ThemeConfig } | { ok: false; issues: ThemeIssue[] } {
  let size = 0;
  try {
    size = JSON.stringify(raw ?? null).length;
  } catch {
    return { ok: false, issues: [{ path: "", message: "Theme config is not valid JSON" }] };
  }
  if (size > MAX_CONFIG_BYTES) return { ok: false, issues: [{ path: "", message: "Theme is too large" }] };
  const { config, issues } = parseAll(raw);
  return issues.length ? { ok: false, issues } : { ok: true, config };
}

/** Every storage path referenced anywhere in the config (for tenant-ownership checks on save). */
export function collectAssetPaths(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    if (STORAGE_PATH_RE.test(value)) out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectAssetPaths(v, out);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectAssetPaths(v, out);
  }
  return out;
}

/** True when every uploaded asset referenced by the config belongs to this tenant. */
export function assetsBelongToTenant(config: ThemeConfig, tenantId: string): boolean {
  return collectAssetPaths(config).every((p) => p.startsWith(`tenant/${tenantId}/`));
}

/** Only visible sections for the current device class are rendered; both flags false = hidden. */
export function isSectionHidden(section: SectionInstance): boolean {
  return !section.visibility.desktop && !section.visibility.mobile;
}
