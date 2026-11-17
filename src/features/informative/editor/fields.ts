import { SECTION_TYPES, type PageSection, type SectionType } from "../sections";

/**
 * Website editor field schema (pure, unit tested). One entry per section type: what the seller can
 * edit in the section's settings panel. Keys are the section's `props` keys, named exactly as the
 * renderer (site/sections.tsx) reads them (the prop contract agreed with the renderer slice:
 * docs/informative/EDITOR_PLAN.md). Content fields come first; every type also gets the common
 * style group (background, spacing, alignment). tests/unit/informative/editor-fields.test.ts checks
 * the keys against the renderer source.
 */

type Base = { key: string; label: string; hint?: string; group?: "style" };
export type SelectOption = { value: string; label: string };

export type ScalarField =
  | (Base & { kind: "text"; maxLength?: number; placeholder?: string })
  | (Base & { kind: "textarea" | "richtext"; maxLength?: number; rows?: number; placeholder?: string })
  | (Base & { kind: "number"; min: number; max: number; step?: number })
  /** `options: "services"` = the site's services (filled in by the editor page). */
  | (Base & { kind: "select"; options: SelectOption[] | "services"; emptyLabel?: string })
  | (Base & { kind: "toggle" })
  | (Base & { kind: "color" })
  /** Value: { label, href }. */
  | (Base & { kind: "link" })
  /** Value: tenant media path (string) or absent. */
  | (Base & { kind: "image"; query?: string })
  /** Value: string[] (one entry per line). */
  | (Base & { kind: "lines"; max: number; maxLength?: number; placeholder?: string });

export type ListField = Base & { kind: "list"; itemLabel: string; max: number; fields: ScalarField[] };
export type FieldDef = ScalarField | ListField;
export type FieldKind = FieldDef["kind"];

export type SectionMeta = {
  label: string;
  description: string;
  fields: FieldDef[];
  /** Content that comes from elsewhere in the panel (services, team…). */
  manage?: { label: string; href: string };
  /** Shown in the preview when the section has nothing to render yet. */
  emptyHint?: string;
};

const opts = (...pairs: [string, string][]): SelectOption[] => pairs.map(([value, label]) => ({ value, label }));
const DEFAULT = "Design default";

const eyebrow: ScalarField = { kind: "text", key: "eyebrow", label: "Small label above the heading", maxLength: 40 };
const heading = (placeholder?: string): ScalarField => ({ kind: "text", key: "heading", label: "Heading", maxLength: 120, placeholder });
const subheading = (placeholder?: string): ScalarField => ({ kind: "textarea", key: "subheading", label: "Sub-heading", maxLength: 300, rows: 2, placeholder });
const limit = (max: number, label: string): ScalarField => ({ kind: "number", key: "limit", label, min: 1, max, hint: "Leave empty to show all." });
const link = (key: string, label: string, hint?: string): ScalarField => ({ kind: "link", key, label, hint });
const image = (key: string, label: string, query: string, hint?: string): ScalarField => ({ kind: "image", key, label, query, hint });

/** Common style group on every section. */
export const STYLE_FIELDS: ScalarField[] = [
  { kind: "select", key: "background", label: "Background", group: "style", options: opts(["", DEFAULT], ["surface", "Soft panel"], ["accent", "Brand colour"], ["dark", "Dark"], ["image", "Image"]) },
  { kind: "image", key: "backgroundImage", label: "Background image", group: "style", query: "texture background", hint: "Used when Background is Image." },
  { kind: "select", key: "spacing", label: "Spacing", group: "style", options: opts(["", DEFAULT], ["compact", "Compact"], ["normal", "Normal"], ["spacious", "Spacious"]) },
  { kind: "select", key: "align", label: "Alignment", group: "style", options: opts(["", DEFAULT], ["left", "Left"], ["center", "Centre"]) },
];

/** Every section starts with these text fields (heading placeholder = the renderer's fallback). */
const head = (headingPlaceholder?: string, subPlaceholder?: string): ScalarField[] => [eyebrow, heading(headingPlaceholder), subheading(subPlaceholder)];
const servicesOptions: FieldDef[] = [
  limit(24, "How many services to show"),
  { kind: "toggle", key: "showPrices", label: "Show prices" },
  { kind: "text", key: "ctaLabel", label: "Button text on each service", maxLength: 40, placeholder: "View details" },
];

const CONTENT: Record<SectionType, SectionMeta> = {
  hero: {
    label: "Hero banner",
    description: "Big headline at the top with your main buttons.",
    fields: [
      ...head("Your business name", "Your tagline"),
      { kind: "textarea", key: "text", label: "Extra text", maxLength: 600, rows: 3 },
      image("image", "Hero image", "business", "Leave empty to use the hero image from Customize."),
      { kind: "select", key: "layout", label: "Layout", options: opts(["", DEFAULT], ["split", "Text and image side by side"], ["fullBleedImage", "Full-width image"], ["typographic", "Text only"], ["carousel", "Slideshow"]) },
      link("primaryCta", "Main button", "Leave empty to use your contact button."),
      link("secondaryCta", "Second button", "Leave empty to link to your services."),
    ],
  },
  about: {
    label: "About",
    description: "Your story, with a photo.",
    fields: [
      ...head("About your business"),
      { kind: "richtext", key: "text", label: "Text", maxLength: 2000, rows: 6, hint: "Leave empty to use the 'About' text from Business info." },
      image("image", "Photo", "team at work"),
      { kind: "select", key: "imagePosition", label: "Photo position", options: opts(["", DEFAULT], ["left", "Left"], ["right", "Right"]) },
    ],
  },
  services_grid: {
    label: "Services (cards)",
    description: "Your services as cards with prices.",
    fields: [...head("Services"), ...servicesOptions],
    manage: { label: "Manage services", href: "/informative/services" },
    emptyHint: "Shows when you add services.",
  },
  services_list: {
    label: "Services (list)",
    description: "A clean menu-style list of services and prices.",
    fields: [...head("Services"), ...servicesOptions],
    manage: { label: "Manage services", href: "/informative/services" },
    emptyHint: "Shows when you add services.",
  },
  highlights: {
    label: "Why choose us",
    description: "A few reasons customers pick you.",
    fields: [
      ...head("Why people choose us"),
      {
        kind: "list",
        key: "items",
        label: "Reasons",
        itemLabel: "Reason",
        max: 8,
        fields: [
          { kind: "text", key: "icon", label: "Icon (emoji)", maxLength: 8, placeholder: "⭐" },
          { kind: "text", key: "title", label: "Title", maxLength: 80 },
          { kind: "textarea", key: "text", label: "Text", maxLength: 300, rows: 2 },
        ],
      },
    ],
    emptyHint: "Add a few reasons to show this section.",
  },
  stats: {
    label: "Stats",
    description: "Numbers that build trust (years, clients, ratings).",
    fields: [
      ...head("At a glance"),
      {
        kind: "list",
        key: "items",
        label: "Numbers",
        itemLabel: "Number",
        max: 6,
        fields: [
          { kind: "text", key: "value", label: "Value", maxLength: 20, placeholder: "10+" },
          { kind: "text", key: "label", label: "Label", maxLength: 60, placeholder: "Years of experience" },
        ],
      },
    ],
    emptyHint: "Add a few numbers to show this section.",
  },
  team: {
    label: "Team",
    description: "The people behind your business.",
    fields: [...head("Meet the team"), limit(24, "How many people to show")],
    manage: { label: "Manage team", href: "/informative/team" },
    emptyHint: "Shows when you add team members.",
  },
  gallery: {
    label: "Gallery",
    description: "Photos of your work or place.",
    fields: [...head("Our work"), limit(60, "How many photos to show"), { kind: "select", key: "layout", label: "Layout", options: opts(["", DEFAULT], ["grid", "Grid"], ["masonry", "Masonry"]) }],
    manage: { label: "Manage gallery", href: "/informative/gallery" },
    emptyHint: "Shows when you add gallery photos.",
  },
  testimonials: {
    label: "Testimonials",
    description: "What your clients say about you.",
    fields: [...head("What our clients say"), limit(12, "How many reviews to show"), { kind: "select", key: "layout", label: "Layout", options: opts(["", DEFAULT], ["cards", "Cards"], ["carousel", "Slider"], ["quote", "One big quote"]) }],
    manage: { label: "Manage testimonials", href: "/informative/testimonials" },
    emptyHint: "Shows when you add testimonials.",
  },
  pricing: {
    label: "Pricing",
    description: "Plans or packages side by side.",
    fields: [
      ...head("Simple, clear pricing"),
      {
        kind: "list",
        key: "items",
        label: "Plans",
        itemLabel: "Plan",
        max: 6,
        hint: "Leave empty to show your priced services.",
        fields: [
          { kind: "text", key: "name", label: "Name", maxLength: 60 },
          { kind: "text", key: "price", label: "Price", maxLength: 40, placeholder: "₹999/month" },
          { kind: "lines", key: "features", label: "What's included (one per line)", max: 8, maxLength: 80 },
          { kind: "toggle", key: "highlighted", label: "Highlight this plan" },
          { kind: "text", key: "ctaLabel", label: "Button text", maxLength: 40, placeholder: "Enquire" },
          { kind: "text", key: "ctaHref", label: "Button link", maxLength: 500, placeholder: "/contact" },
        ],
      },
    ],
    manage: { label: "Manage services", href: "/informative/services" },
    emptyHint: "Add plans, or give your services prices.",
  },
  faq: {
    label: "FAQ",
    description: "Answers to common questions.",
    fields: [...head("Frequently asked questions"), limit(30, "How many questions to show")],
    manage: { label: "Manage FAQs", href: "/informative/faqs" },
    emptyHint: "Shows when you add FAQs.",
  },
  cta: {
    label: "Call to action",
    description: "A bold strip that asks visitors to get in touch.",
    fields: [
      ...head("Ready when you are"),
      { kind: "textarea", key: "text", label: "Text", maxLength: 400, rows: 2, placeholder: "Tell us what you need and we'll get back to you within a day." },
      image("image", "Image", "happy customer"),
      link("primaryCta", "Main button", "Leave empty to use your contact button."),
      link("secondaryCta", "Second button"),
    ],
  },
  contact: {
    label: "Contact details",
    description: "Phone, WhatsApp, email and map.",
    fields: [...head("Get in touch"), { kind: "toggle", key: "showMap", label: "Show map" }, { kind: "toggle", key: "showHours", label: "Show opening hours" }],
    manage: { label: "Edit contact details", href: "/informative/business" },
    emptyHint: "Shows when you add a phone, email or address.",
  },
  enquiry_form: {
    label: "Enquiry form",
    description: "Lets visitors send you an enquiry.",
    fields: [
      ...head("Send us an enquiry"),
      { kind: "textarea", key: "text", label: "Intro text", maxLength: 300, rows: 2, placeholder: "We usually reply within a day." },
      { kind: "select", key: "serviceId", label: "Pre-select a service", options: "services", emptyLabel: "None (visitor chooses)" },
    ],
  },
  rich_text: {
    label: "Text block",
    description: "A heading and paragraphs of your own text.",
    fields: [...head(), { kind: "richtext", key: "text", label: "Text", maxLength: 2000, rows: 8, hint: "Leave a blank line between paragraphs. **Bold** is allowed." }],
    emptyHint: "Add some text to show this block.",
  },
};

export const SECTION_FIELDS: Record<SectionType, SectionMeta> = Object.fromEntries(
  SECTION_TYPES.map((t) => [t, { ...CONTENT[t], fields: [...CONTENT[t].fields, ...STYLE_FIELDS] }]),
) as Record<SectionType, SectionMeta>;

export const sectionLabel = (t: SectionType): string => SECTION_FIELDS[t].label;
export const EDITOR_SECTION_TYPES: readonly SectionType[] = SECTION_TYPES;

// ---- Values ---------------------------------------------------------------------------------------

export type LinkValue = { label: string; href: string };

/** Links a seller may enter: site paths, anchors, web, phone, email and WhatsApp. */
export function isSafeHref(href: string): boolean {
  const v = href.trim();
  if (!v) return true;
  if (v.length > 500) return false;
  if (/^\/(?!\/)/.test(v) || v.startsWith("#")) return true;
  return /^(https?:\/\/[^\s]+|tel:\+?[\d\s-]{6,20}|mailto:[^\s@]+@[^\s@]+)$/i.test(v);
}

export function readLink(v: unknown): LinkValue {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    return { label: typeof o.label === "string" ? o.label : "", href: typeof o.href === "string" ? o.href : "" };
  }
  return { label: "", href: "" };
}

export function readList(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object" && !Array.isArray(x)) : [];
}

const isEmpty = (v: unknown): boolean =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.values(v as object).every(isEmpty));

/**
 * Props ready to save: strings trimmed, empty values removed (so the renderer's fallbacks apply),
 * empty list items dropped. Keys the schema doesn't know are kept (AI or older editors may add them;
 * the renderer ignores unknown props).
 */
export function compactProps(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    let next: unknown = v;
    if (typeof v === "string") next = v.trim();
    else if (Array.isArray(v)) next = v.map((x) => (x && typeof x === "object" && !Array.isArray(x) ? compactProps(x as Record<string, unknown>) : x)).filter((x) => !isEmpty(x));
    else if (v && typeof v === "object") next = compactProps(v as Record<string, unknown>);
    if (!isEmpty(next)) out[k] = next;
  }
  return out;
}

export function compactSections(sections: readonly PageSection[]): PageSection[] {
  return sections.map((s, i) => ({ ...s, order: i, props: compactProps(s.props) }));
}

/** Field-level problems the seller should fix before saving (bad links). Keyed `sectionId.key`. */
export function fieldProblems(sections: readonly PageSection[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of sections) {
    for (const f of SECTION_FIELDS[s.type].fields) {
      if (f.kind === "link" && !isSafeHref(readLink(s.props[f.key]).href)) out[`${s.id}.${f.key}`] = "Use a page address like /contact, a full https:// link, tel: or mailto:.";
      if (f.kind === "list") {
        readList(s.props[f.key]).forEach((item, i) => {
          for (const sub of f.fields) {
            const href = sub.kind === "link" ? readLink(item[sub.key]).href : sub.key.endsWith("Href") && typeof item[sub.key] === "string" ? (item[sub.key] as string) : "";
            if (!isSafeHref(href)) out[`${s.id}.${f.key}.${i}.${sub.key}`] = "Use a page address like /contact, a full https:// link, tel: or mailto:.";
          }
        });
      }
    }
  }
  return out;
}
