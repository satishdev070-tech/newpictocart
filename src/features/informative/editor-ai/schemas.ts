import { z } from "zod";
import { SECTION_TYPES, sectionSchema, type PageSection, type SectionType } from "../sections";
import { SECTION_PROP_DOCS } from "./prompts";

/**
 * Website editor AI (pure; unit tested): action inputs, the JSON the model returns, and the
 * mapping from model output to a valid PageSection. Model text is cleaned and capped rather than
 * rejected; unknown section types are rejected; keys a section doesn't read are dropped.
 */

const isSectionType = (v: unknown): v is SectionType => typeof v === "string" && (SECTION_TYPES as readonly string[]).includes(v);

const oneLine = (s: string, max: number) => s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const paragraphs = (s: string, max: number) =>
  s
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);

// ---- Action inputs ------------------------------------------------------------------------------

const locale = z.string().trim().max(16).optional();

export const generateSectionInputSchema = z.object({
  pageId: z.uuid(),
  type: z.enum(SECTION_TYPES).optional(),
  instruction: z.string().trim().max(600).default(""),
  locale,
});
export type GenerateSectionInput = z.output<typeof generateSectionInputSchema>;

export const rewriteSectionInputSchema = z.object({
  pageId: z.uuid(),
  section: sectionSchema,
  instruction: z.string().trim().max(600).optional(),
  locale,
});
export type RewriteSectionInput = z.output<typeof rewriteSectionInputSchema>;

// ---- Generated section --------------------------------------------------------------------------

/** Props for one type: only the keys the renderer reads, cleaned and capped; empty values dropped. */
export function sectionPropsSchema(type: SectionType) {
  const docs = SECTION_PROP_DOCS[type].props;
  return z.record(z.string(), z.unknown()).transform((raw, ctx) => {
    const out: Record<string, string> = {};
    for (const d of docs) {
      const v = raw[d.key];
      if (typeof v !== "string") continue;
      const t = d.kind === "paragraph" ? paragraphs(v, d.max) : oneLine(v, d.max);
      if (t) out[d.key] = t;
    }
    for (const d of docs) {
      if (d.required && !out[d.key]) ctx.addIssue({ code: "custom", path: [d.key], message: `"${d.key}" is required` });
    }
    return out;
  });
}

/**
 * The model's answer for "Add with AI": `{type, props}`. With a requested type the model's own
 * `type` is ignored (it cannot switch to another type); without one it must be a known type.
 */
export function generatedSectionSchema(requested?: SectionType) {
  return z
    .object({ type: z.unknown().optional(), props: z.record(z.string(), z.unknown()).catch({}).default({}) })
    .transform((raw, ctx) => {
      const type = requested ?? raw.type;
      if (!isSectionType(type)) {
        ctx.addIssue({ code: "custom", path: ["type"], message: "unknown section type" });
        return z.NEVER;
      }
      const props = sectionPropsSchema(type).safeParse(raw.props);
      if (!props.success) {
        for (const i of props.error.issues) ctx.addIssue({ code: "custom", path: ["props", ...i.path.map(String)], message: i.message });
        return z.NEVER;
      }
      return { type, props: props.data as Record<string, unknown> };
    });
}
export type GeneratedSection = { type: SectionType; props: Record<string, unknown> };

/** A section id not used on the page yet (sectionSchema: letters, digits, _ and -). */
export function newSectionId(existing: readonly { id: string }[], random: () => string = () => crypto.randomUUID().replace(/-/g, "").slice(0, 10)): string {
  const taken = new Set(existing.map((s) => s.id));
  for (let i = 0; i < 20; i++) {
    const id = `ai-${random()}`;
    if (!taken.has(id)) return id;
  }
  return `ai-${Date.now().toString(36)}`;
}

/** Model output → a new, valid PageSection placed at the end of the page and visible. */
export function toNewSection(generated: GeneratedSection, existing: readonly PageSection[], random?: () => string): PageSection {
  const last = existing.reduce((max, s) => Math.max(max, s.order), -1);
  return sectionSchema.parse({
    id: newSectionId(existing, random),
    type: generated.type,
    props: generated.props,
    order: Math.min(1000, last + 1),
    visible: true,
  });
}

// ---- Rewrite ------------------------------------------------------------------------------------

/**
 * Keys whose string values are copy the AI may rewrite (top level or inside lists of items).
 * Anything else — ids, image paths, URLs, links, service ids, alt text with photo credits,
 * people's names — is never sent and never changed.
 */
export const TEXT_KEYS = new Set([
  "heading",
  "subheading",
  "eyebrow",
  "title",
  "subtitle",
  "intro",
  "text",
  "body",
  "description",
  "caption",
  "label",
  "buttonLabel",
  "ctaLabel",
  "question",
  "answer",
  "quote",
]);

const MAX_FIELDS = 40;
const looksLikeLink = (s: string) => /^(https?:|mailto:|tel:|\/|#|tenant\/|icon:)/i.test(s.trim());

export type TextField = { path: string; value: string };

/** The rewritable text in a section's props, as dotted paths (e.g. "heading", "items.0.title"). */
export function collectTextFields(props: Record<string, unknown>): TextField[] {
  const out: TextField[] = [];
  const walk = (node: unknown, path: string[], depth: number) => {
    if (out.length >= MAX_FIELDS || depth > 3) return;
    if (Array.isArray(node)) {
      node.slice(0, 20).forEach((v, i) => walk(v, [...path, String(i)], depth + 1));
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (out.length >= MAX_FIELDS) return;
      if (typeof v === "string") {
        if (TEXT_KEYS.has(k) && v.trim() && !looksLikeLink(v)) out.push({ path: [...path, k].join("."), value: v });
      } else if (v && typeof v === "object") {
        walk(v, [...path, k], depth + 1);
      }
    }
  };
  walk(props, [], 0);
  return out;
}

export const rewriteOutputSchema = z.object({
  fields: z.record(z.string().max(200), z.unknown()).transform((f) => Object.fromEntries(Object.entries(f).filter((e): e is [string, string] => typeof e[1] === "string"))),
});
export type RewriteOutput = z.output<typeof rewriteOutputSchema>;

/** Cap for a rewritten field: the documented max for a known top-level prop, else 3× the original (≤ 3000). */
function capFor(type: SectionType, path: string, original: string): { max: number; multiline: boolean } {
  const doc = SECTION_PROP_DOCS[type].props.find((p) => p.key === path);
  if (doc) return { max: doc.max, multiline: doc.kind === "paragraph" };
  return { max: Math.min(3000, Math.max(120, original.length * 3)), multiline: original.includes("\n") };
}

/**
 * Applies the rewritten text to a copy of the section: only the paths that were sent are touched,
 * blank answers keep the original, and id, type, order, visibility, images and links are kept.
 */
export function applyRewrite(section: PageSection, sent: readonly TextField[], fields: Record<string, string>): PageSection {
  const props = structuredClone(section.props) as Record<string, unknown>;
  for (const f of sent) {
    const next = fields[f.path];
    if (typeof next !== "string") continue;
    const { max, multiline } = capFor(section.type, f.path, f.value);
    const value = multiline ? paragraphs(next, max) : oneLine(next, max);
    if (!value) continue;
    const keys = f.path.split(".");
    let node: unknown = props;
    for (const k of keys.slice(0, -1)) node = (node as Record<string, unknown>)[k];
    (node as Record<string, unknown>)[keys[keys.length - 1]!] = value;
  }
  return sectionSchema.parse({ ...section, props });
}
