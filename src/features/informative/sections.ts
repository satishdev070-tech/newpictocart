import { z } from "zod";

/**
 * Page section contract (pure). InfoPage.sections = [{ id, type, props, order, visible }]. Validated
 * on save AND on render (unknown types are dropped at render). Per-type props are refined by the
 * theme section library (M3); here props are a bounded JSON object.
 */
export const SECTION_TYPES = [
  "hero",
  "about",
  "services_grid",
  "services_list",
  "highlights",
  "stats",
  "team",
  "gallery",
  "testimonials",
  "pricing",
  "faq",
  "cta",
  "contact",
  "enquiry_form",
  "rich_text",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

const MAX_PROPS_JSON = 20_000;

export const sectionSchema = z.object({
  id: z.string().trim().min(1).max(40).regex(/^[a-zA-Z0-9_-]+$/),
  type: z.enum(SECTION_TYPES),
  props: z
    .record(z.string().max(60), z.unknown())
    .default({})
    .refine((p) => JSON.stringify(p).length <= MAX_PROPS_JSON, "Section content is too large"),
  order: z.number().int().min(0).max(1000),
  visible: z.boolean().default(true),
});
export type PageSection = z.infer<typeof sectionSchema>;

export const sectionsSchema = z
  .array(sectionSchema)
  .max(40, "A page can have at most 40 sections")
  .refine((list) => new Set(list.map((s) => s.id)).size === list.length, "Section ids must be unique");

/** Stored JSON → valid sections, sorted by order. Invalid entries are dropped, never thrown (render path). */
export function parseStoredSections(raw: unknown): PageSection[] {
  if (!Array.isArray(raw)) return [];
  const out: PageSection[] = [];
  const seen = new Set<string>();
  for (const item of raw.slice(0, 40)) {
    const r = sectionSchema.safeParse(item);
    if (r.success && !seen.has(r.data.id)) {
      seen.add(r.data.id);
      out.push(r.data);
    }
  }
  return out.sort((a, b) => a.order - b.order);
}

/** The four system pages every site gets (created in M4 onboarding with the theme's default sections). */
export const SYSTEM_PAGES = [
  { type: "HOME", title: "Home", slug: "home" },
  { type: "ABOUT", title: "About", slug: "about" },
  { type: "SERVICES", title: "Services", slug: "services" },
  { type: "CONTACT", title: "Contact", slug: "contact" },
] as const;
export const PAGE_TYPES = ["HOME", "ABOUT", "SERVICES", "CONTACT", "CUSTOM"] as const;
export type PageType = (typeof PAGE_TYPES)[number];
