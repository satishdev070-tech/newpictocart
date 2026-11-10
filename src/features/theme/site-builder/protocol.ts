/**
 * postMessage protocol between the site builder (dashboard, platform origin) and the canvas
 * (the storefront in an iframe, store origin). Pure.
 *
 * Both sides check `event.origin` (the builder: the store origin it framed; the canvas: one of the
 * platform origins, e.g. with and without "www.") and `event.source` (the builder: its own iframe; the
 * canvas: window.parent). The canvas renders through renderCanvasAction, which re-validates the theme
 * and is authorised by the short-lived, tenant-bound preview token: the builder sends it with every
 * theme message (posted only to the framed store origin), so a blocked or expired third-party cookie
 * no longer breaks editing. The builder only applies edits it can validate itself.
 */

export const HOST_TAG = "pc-builder-host" as const;
export const CANVAS_TAG = "pc-builder-canvas" as const;

/** Toolbar / menu actions on a section. */
export const SECTION_ACTIONS = ["edit", "design", "settings", "colors", "up", "down", "duplicate", "hide", "delete"] as const;
export type SectionAction = (typeof SECTION_ACTIONS)[number];

/** Text roles the canvas can select / resize (must match schema/text-style TEXT_ROLES). */
export const TEXT_ROLES = ["heading", "subheading", "body", "cta", "eyebrow"] as const;
export type ProtocolTextRole = (typeof TEXT_ROLES)[number];

export type HostMessage =
  /** Theme to render (JSON string, already validated by the builder) and the selected section. */
  | { tag: typeof HOST_TAG; type: "theme"; rev: number; config: string; changedLists: string[] | "all"; token?: string }
  /** "Are you there?": sent until the canvas answers "ready" (covers a ready that was missed). */
  | { tag: typeof HOST_TAG; type: "hello" }
  | { tag: typeof HOST_TAG; type: "select"; sectionId: string | null }
  /** Highlight a text box on the canvas (null clears text selection). */
  | { tag: typeof HOST_TAG; type: "textSelect"; sectionId: string | null; role: ProtocolTextRole | null; itemIndex?: number }
  /** Popup to show open on the canvas (null closes it). */
  | { tag: typeof HOST_TAG; type: "popup"; popupId: string | null }
  | { tag: typeof HOST_TAG; type: "scrollTo"; sectionId: string }
  /** Display names for the canvas label chips ("Hero / Slideshow"), by section id. */
  | { tag: typeof HOST_TAG; type: "labels"; labels: Record<string, string> };

export type CanvasMessage =
  | { tag: typeof CANVAS_TAG; type: "ready"; path: string; slots: string[] }
  /** The canvas document is unloading (a hard navigation or reload): the next one says "ready" again. */
  | { tag: typeof CANVAS_TAG; type: "leaving" }
  /** `code` "forbidden" = the preview cookie is missing or expired (the builder re-enters the preview). */
  | { tag: typeof CANVAS_TAG; type: "rendered"; rev: number; ok: boolean; error?: string; code?: "forbidden" | "failed" }
  | { tag: typeof CANVAS_TAG; type: "select"; slot: string; sectionId: string }
  /** Seller clicked a text box (`data-pc-text`) — open the section Edit tab and show resize chrome. */
  | { tag: typeof CANVAS_TAG; type: "textSelect"; slot: string; sectionId: string; role: ProtocolTextRole; itemIndex?: number }
  /** Drag-resize result: new text-box width as % of the column (0–100). */
  | { tag: typeof CANVAS_TAG; type: "textResize"; slot: string; sectionId: string; role: ProtocolTextRole; widthPct: number; itemIndex?: number }
  | { tag: typeof CANVAS_TAG; type: "action"; slot: string; sectionId: string; action: SectionAction }
  /** "+" (or "Add with AI") at a position: insert relative to `sectionId` (null = start of slot). */
  | { tag: typeof CANVAS_TAG; type: "insert"; slot: string; sectionId: string | null; where: "before" | "after"; ai: boolean };

const SECTION_ID = /^[a-z0-9][a-z0-9-]{2,39}$/;
/** Signed preview token shape (base64url payload "." base64url signature). */
export const PREVIEW_TOKEN_RE = /^[A-Za-z0-9_-]{10,1500}\.[A-Za-z0-9_-]{10,200}$/;
const SLOT = /^[a-zA-Z0-9.-]{3,60}$/;

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function textRoleOf(v: unknown): ProtocolTextRole | null {
  return typeof v === "string" && (TEXT_ROLES as readonly string[]).includes(v) ? (v as ProtocolTextRole) : null;
}

function itemIndexOf(v: unknown): number | undefined {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 20 ? v : undefined;
}

function widthPctOf(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 100 ? v : null;
}

/** Validates a message received by the BUILDER from the canvas. */
export function parseCanvasMessage(data: unknown): CanvasMessage | null {
  if (!isObj(data) || data.tag !== CANVAS_TAG) return null;
  const slot = typeof data.slot === "string" && SLOT.test(data.slot) ? data.slot : null;
  const sectionId = typeof data.sectionId === "string" && SECTION_ID.test(data.sectionId) ? data.sectionId : null;
  switch (data.type) {
    case "ready":
      return typeof data.path === "string" && Array.isArray(data.slots)
        ? { tag: CANVAS_TAG, type: "ready", path: data.path.slice(0, 300), slots: data.slots.filter((s): s is string => typeof s === "string" && SLOT.test(s)).slice(0, 12) }
        : null;
    case "leaving":
      return { tag: CANVAS_TAG, type: "leaving" };
    case "rendered":
      return typeof data.rev === "number"
        ? {
            tag: CANVAS_TAG,
            type: "rendered",
            rev: data.rev,
            ok: data.ok === true,
            ...(typeof data.error === "string" ? { error: data.error.slice(0, 200) } : {}),
            ...(data.code === "forbidden" || data.code === "failed" ? { code: data.code } : {}),
          }
        : null;
    case "select":
      return slot && sectionId ? { tag: CANVAS_TAG, type: "select", slot, sectionId } : null;
    case "textSelect": {
      const role = textRoleOf(data.role);
      const itemIndex = itemIndexOf(data.itemIndex);
      return slot && sectionId && role
        ? { tag: CANVAS_TAG, type: "textSelect", slot, sectionId, role, ...(itemIndex !== undefined ? { itemIndex } : {}) }
        : null;
    }
    case "textResize": {
      const role = textRoleOf(data.role);
      const widthPct = widthPctOf(data.widthPct);
      const itemIndex = itemIndexOf(data.itemIndex);
      return slot && sectionId && role && widthPct !== null
        ? { tag: CANVAS_TAG, type: "textResize", slot, sectionId, role, widthPct, ...(itemIndex !== undefined ? { itemIndex } : {}) }
        : null;
    }
    case "action":
      return slot && sectionId && (SECTION_ACTIONS as readonly unknown[]).includes(data.action) ? { tag: CANVAS_TAG, type: "action", slot, sectionId, action: data.action as SectionAction } : null;
    case "insert":
      return slot && (data.where === "before" || data.where === "after")
        ? { tag: CANVAS_TAG, type: "insert", slot, sectionId: data.sectionId === null ? null : sectionId, where: data.where, ai: data.ai === true }
        : null;
    default:
      return null;
  }
}

/** Validates a message received by the CANVAS from the builder. */
export function parseHostMessage(data: unknown): HostMessage | null {
  if (!isObj(data) || data.tag !== HOST_TAG) return null;
  switch (data.type) {
    case "theme":
      return typeof data.rev === "number" && typeof data.config === "string" && (data.changedLists === "all" || Array.isArray(data.changedLists))
        ? {
            tag: HOST_TAG,
            type: "theme",
            rev: data.rev,
            config: data.config,
            changedLists: data.changedLists === "all" ? "all" : (data.changedLists as unknown[]).filter((s): s is string => typeof s === "string").slice(0, 20),
            ...(typeof data.token === "string" && PREVIEW_TOKEN_RE.test(data.token) ? { token: data.token } : {}),
          }
        : null;
    case "hello":
      return { tag: HOST_TAG, type: "hello" };
    case "select":
      return { tag: HOST_TAG, type: "select", sectionId: typeof data.sectionId === "string" && SECTION_ID.test(data.sectionId) ? data.sectionId : null };
    case "textSelect": {
      const sectionId = typeof data.sectionId === "string" && SECTION_ID.test(data.sectionId) ? data.sectionId : null;
      const role = textRoleOf(data.role);
      const itemIndex = itemIndexOf(data.itemIndex);
      return { tag: HOST_TAG, type: "textSelect", sectionId, role, ...(itemIndex !== undefined ? { itemIndex } : {}) };
    }
    case "popup":
      return { tag: HOST_TAG, type: "popup", popupId: typeof data.popupId === "string" && SECTION_ID.test(data.popupId) ? data.popupId : null };
    case "scrollTo":
      return typeof data.sectionId === "string" && SECTION_ID.test(data.sectionId) ? { tag: HOST_TAG, type: "scrollTo", sectionId: data.sectionId } : null;
    case "labels": {
      if (!isObj(data.labels)) return null;
      const labels: Record<string, string> = {};
      for (const [id, label] of Object.entries(data.labels).slice(0, 500)) {
        if (SECTION_ID.test(id) && typeof label === "string") labels[id] = label.slice(0, 80);
      }
      return { tag: HOST_TAG, type: "labels", labels };
    }
    default:
      return null;
  }
}
