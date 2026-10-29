import type { EditorField, SectionDefinition } from "@/features/theme/sections/types";
import type { SectionTab } from "./context";

/**
 * Field grouping for the section panel (pure). A section definition's flat field list is split
 * into the panel's four tabs, list items are labelled, and item fields are grouped into the
 * toggleable blocks of the item editor (Subtitle / Title / Description / Media / Action buttons).
 */

export type ListField = Extract<EditorField, { kind: "list" }>;
export type SelectField = Extract<EditorField, { kind: "select" }>;
export type FieldTabs = Record<SectionTab, EditorField[]>;

const COLOUR_KEY_RE = /tone|colou?r|textTone|panelTone/i;
/** Selects that are settings even when shaped like content. */
const SETTINGS_KEYS = new Set(["spacing", "cardRatio"]);

export const isVariantField = (f: EditorField): boolean => f.kind === "select" && f.display === "variants";

function baseTab(f: EditorField): SectionTab {
  if (isVariantField(f)) return "design";
  if (f.kind === "color") return "colors";
  if (f.kind === "select" && COLOUR_KEY_RE.test(f.key)) return "colors";
  if (SETTINGS_KEYS.has(f.key)) return "settings";
  if (f.kind === "select" || f.kind === "number" || f.kind === "toggle") return "settings";
  return "edit";
}

/**
 * Partition fields into tabs. Every field lands in exactly one tab, in definition order.
 * Refinement: a select or toggle that controls (`showIf`) a content field moves to Edit with it
 * (e.g. "Products from" + its collection picker), and every field controlled by an Edit select follows
 * it, so a condition and its dependants are always on the same tab.
 */
export function partitionFields(fields: readonly EditorField[]): FieldTabs {
  const tab = new Map<string, SectionTab>(fields.map((f) => [f.key, baseTab(f)]));
  for (let changed = true; changed; ) {
    changed = false;
    for (const f of fields) {
      const ctrl = f.showIf?.key;
      if (!ctrl || !tab.has(ctrl)) continue;
      const controller = fields.find((x) => x.key === ctrl)!;
      if (tab.get(f.key) === "edit" && tab.get(ctrl) !== "edit" && (controller.kind === "select" || controller.kind === "toggle") && !isVariantField(controller)) {
        tab.set(ctrl, "edit");
        changed = true;
      }
      if (tab.get(ctrl) === "edit" && tab.get(f.key) !== "edit") {
        tab.set(f.key, "edit");
        changed = true;
      }
    }
  }
  const out: FieldTabs = { edit: [], design: [], settings: [], colors: [] };
  for (const f of fields) out[tab.get(f.key)!].push(f);
  return out;
}

export const sectionTabs = (def: Pick<SectionDefinition, "fields">): FieldTabs => partitionFields(def.fields);

/** The "Manage list" field of a section: its first list field. */
export function primaryListField(def: Pick<SectionDefinition, "fields">): ListField | null {
  return (def.fields.find((f) => f.kind === "list") as ListField | undefined) ?? null;
}

/** Fields visible for a values object (respects showIf). */
export function visibleFields(fields: readonly EditorField[], values: Record<string, unknown>): EditorField[] {
  return fields.filter((f) => !f.showIf || f.showIf.equals.includes(values[f.showIf.key] as string | boolean));
}

// -----------------------------------------------------------------------------
// List items
// -----------------------------------------------------------------------------

const LABEL_KEYS = ["heading", "title", "name", "label", "question", "text", "quote", "caption", "author", "value", "eyebrow", "alt"];

/**
 * Label for a list item: the first non-empty text among the usual title-like keys (then any other
 * text field), else `fallback`. `resolve` can name picker values (e.g. a category id → its name).
 */
export function itemLabel(item: Record<string, unknown>, fields: readonly EditorField[], fallback: string, resolve?: (f: EditorField, value: string) => string | null): string {
  const pick = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  for (const k of LABEL_KEYS) {
    const f = fields.find((x) => x.key === k);
    if (f && f.kind === "text" && pick(item[k])) return clip(pick(item[k]));
  }
  for (const f of fields) if (f.kind === "text" && pick(item[f.key])) return clip(pick(item[f.key]));
  if (resolve) {
    for (const f of fields) {
      if (f.kind !== "picker" || !pick(item[f.key])) continue;
      const name = resolve(f, pick(item[f.key]));
      if (name) return clip(name);
    }
  }
  return fallback;
}

const clip = (s: string) => (s.length > 60 ? `${s.slice(0, 59)}…` : s);

/** A new list item: each item field's empty value (callers merge schema defaults over this). */
export function blankItem(fields: readonly EditorField[]): Record<string, unknown> {
  return Object.fromEntries(
    fields.map((f) => [
      f.key,
      f.kind === "toggle" ? false : f.kind === "number" ? f.min : f.kind === "multiPicker" || f.kind === "tags" ? [] : f.kind === "select" ? (f.options[0]?.value ?? "") : f.kind === "list" ? [] : "",
    ]),
  );
}

/** Key of a boolean item field that hides an item ("hidden" true = hidden, "enabled"/"visible"/"show" false = hidden), or null. */
export function itemHideField(fields: readonly EditorField[]): { key: string; hiddenWhen: boolean } | null {
  for (const f of fields) {
    if (f.kind !== "toggle") continue;
    if (f.key === "hidden") return { key: f.key, hiddenWhen: true };
    if (f.key === "enabled" || f.key === "visible" || f.key === "show") return { key: f.key, hiddenWhen: false };
  }
  return null;
}

// -----------------------------------------------------------------------------
// Item editor groups
// -----------------------------------------------------------------------------

export type ItemGroupId = "subtitle" | "title" | "description" | "media" | "actions" | "other";
export type ItemGroup = { id: ItemGroupId; label: string; fields: EditorField[]; /** Shows an on/off toggle (OFF hides; content is kept). */ toggle: boolean };

/** Persisted on list items (e.g. Hero slides). `false` hides the group; omitted/`true` shows it. */
export type ItemGroupShowKey = "showSubtitle" | "showTitle" | "showDescription" | "showMedia" | "showActions";
export const GROUP_SHOW_KEY: Record<Exclude<ItemGroupId, "other">, ItemGroupShowKey> = {
  subtitle: "showSubtitle",
  title: "showTitle",
  description: "showDescription",
  media: "showMedia",
  actions: "showActions",
};

const GROUP_LABELS: Record<ItemGroupId, string> = { subtitle: "Subtitle", title: "Title", description: "Description", media: "Media", actions: "Action buttons", other: "Other" };
const ORDER: ItemGroupId[] = ["subtitle", "title", "description", "media", "actions", "other"];

function itemGroupOf(f: EditorField, all: readonly EditorField[]): ItemGroupId {
  const k = f.key;
  if (f.kind === "image" || f.kind === "video") return "media";
  if (/^(alt|imageAlt|mediaAlt)$/i.test(k) || /Alt$/.test(k)) return all.some((x) => x.kind === "image" || x.kind === "video") ? "media" : "other";
  if (/^(eyebrow|subtitle|kicker|tagline)$/i.test(k)) return "subtitle";
  if (/^(heading|title|headingAccent|name)$/i.test(k)) return "title";
  if (/^(subheading|text|description|body|quote|answer|caption)$/i.test(k)) return "description";
  if (/^cta(Label|Href)$/i.test(k) || /^button(Label|Href)$/i.test(k)) return "actions";
  // label + href pairs ("label"/"href" alongside an action label).
  if (k === "href" && all.some((x) => x.key === "ctaLabel" || x.key === "buttonLabel")) return "actions";
  return "other";
}

const CLEARABLE = new Set<EditorField["kind"]>(["text", "link", "image", "video"]);

/** Item fields grouped for the item editor (empty groups omitted, fixed order). */
export function itemGroups(fields: readonly EditorField[]): ItemGroup[] {
  const by = new Map<ItemGroupId, EditorField[]>();
  for (const f of fields) {
    const g = itemGroupOf(f, fields);
    by.set(g, [...(by.get(g) ?? []), f]);
  }
  return ORDER.filter((id) => by.has(id)).map((id) => {
    const fs = by.get(id)!;
    return { id, label: GROUP_LABELS[id], fields: fs, toggle: id !== "other" && fs.some((f) => CLEARABLE.has(f.kind)) };
  });
}

/** Whether a group currently has content (legacy heuristic when no show* flag is set). */
export function groupHasContent(group: ItemGroup, item: Record<string, unknown>): boolean {
  return group.fields.some((f) => CLEARABLE.has(f.kind) && typeof item[f.key] === "string" && (item[f.key] as string).trim() !== "");
}

/** Whether a toggleable group should appear as On in the item editor. */
export function isGroupOn(group: ItemGroup, item: Record<string, unknown>, isNew = false): boolean {
  if (isNew || !group.toggle) return true;
  if (group.id === "other") return true;
  const key = GROUP_SHOW_KEY[group.id];
  const flag = item[key];
  if (typeof flag === "boolean") return flag;
  return groupHasContent(group, item);
}

/**
 * Toggle Off/On: set the group's show* flag. Does not clear title/description/media/actions values —
 * Off hides; On restores the same strings/media.
 */
export function setGroupVisible(group: ItemGroup, item: Record<string, unknown>, visible: boolean): Record<string, unknown> {
  if (!group.toggle || group.id === "other") return item;
  return { ...item, [GROUP_SHOW_KEY[group.id]]: visible };
}

/** Storefront / preview: group is shown unless its show* flag is explicitly false. */
export function isGroupShown(groupId: Exclude<ItemGroupId, "other">, item: Record<string, unknown>): boolean {
  return item[GROUP_SHOW_KEY[groupId]] !== false;
}

/** @deprecated Prefer setGroupVisible — kept for callers that still need to wipe values. */
export function clearGroup(group: ItemGroup, item: Record<string, unknown>): Record<string, unknown> {
  const next = { ...item };
  for (const f of group.fields) if (CLEARABLE.has(f.kind)) next[f.key] = "";
  return next;
}
