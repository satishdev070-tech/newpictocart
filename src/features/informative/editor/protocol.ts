import { sectionsSchema, type PageSection } from "../sections";

/**
 * postMessage protocol between the Website editor (/informative/editor) and its preview iframe
 * (/informative/editor-preview). Pure, unit tested. Both pages are on the platform host, so each
 * side accepts messages only from its own origin AND from the expected window (the editor: its
 * iframe's contentWindow; the preview: window.parent). Every payload is re-validated here; the
 * section list goes through the same `sectionsSchema` as a save, so the preview can never render
 * something saving would reject. Nothing in the protocol writes data.
 */

export const EDITOR_TAG = "pc-info-editor" as const;
export const PREVIEW_TAG = "pc-info-preview" as const;
/** Upper bound on one state message (40 sections × 20 kB props is the schema's own cap). */
export const MAX_STATE_CHARS = 850_000;

export type EditorMessage =
  /** The unsaved page to render. `rev` increases with every change. */
  | { tag: typeof EDITOR_TAG; type: "state"; rev: number; sections: PageSection[] }
  /** Section selected in the editor (outlined + scrolled into view in the preview). */
  | { tag: typeof EDITOR_TAG; type: "select"; id: string | null };

export type PreviewMessage =
  | { tag: typeof PREVIEW_TAG; type: "ready" }
  | { tag: typeof PREVIEW_TAG; type: "rendered"; rev: number }
  /** The seller clicked a section in the preview. */
  | { tag: typeof PREVIEW_TAG; type: "select"; id: string };

const SECTION_ID = /^[a-zA-Z0-9_-]{1,40}$/;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isRev = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER;

/** Same-origin check for both sides (the preview is never served from another host). */
export function isTrustedOrigin(origin: string, expected: string): boolean {
  return typeof origin === "string" && origin.length > 0 && origin !== "null" && origin === expected;
}

/** Validates a message received by the PREVIEW from the editor. */
export function parseEditorMessage(data: unknown): EditorMessage | null {
  if (!isObj(data) || data.tag !== EDITOR_TAG) return null;
  switch (data.type) {
    case "state": {
      if (!isRev(data.rev) || !Array.isArray(data.sections)) return null;
      let size = 0;
      try {
        size = JSON.stringify(data.sections).length;
      } catch {
        return null;
      }
      if (size > MAX_STATE_CHARS) return null;
      const r = sectionsSchema.safeParse(data.sections);
      return r.success ? { tag: EDITOR_TAG, type: "state", rev: data.rev, sections: r.data } : null;
    }
    case "select":
      if (data.id === null) return { tag: EDITOR_TAG, type: "select", id: null };
      return typeof data.id === "string" && SECTION_ID.test(data.id) ? { tag: EDITOR_TAG, type: "select", id: data.id } : null;
    default:
      return null;
  }
}

/** Validates a message received by the EDITOR from the preview. */
export function parsePreviewMessage(data: unknown): PreviewMessage | null {
  if (!isObj(data) || data.tag !== PREVIEW_TAG) return null;
  switch (data.type) {
    case "ready":
      return { tag: PREVIEW_TAG, type: "ready" };
    case "rendered":
      return isRev(data.rev) ? { tag: PREVIEW_TAG, type: "rendered", rev: data.rev } : null;
    case "select":
      return typeof data.id === "string" && SECTION_ID.test(data.id) ? { tag: PREVIEW_TAG, type: "select", id: data.id } : null;
    default:
      return null;
  }
}

export const stateMessage = (rev: number, sections: PageSection[]): EditorMessage => ({ tag: EDITOR_TAG, type: "state", rev, sections });
export const selectMessage = (id: string | null): EditorMessage => ({ tag: EDITOR_TAG, type: "select", id });
export const readyMessage = (): PreviewMessage => ({ tag: PREVIEW_TAG, type: "ready" });
export const renderedMessage = (rev: number): PreviewMessage => ({ tag: PREVIEW_TAG, type: "rendered", rev });
export const previewSelectMessage = (id: string): PreviewMessage => ({ tag: PREVIEW_TAG, type: "select", id });

/** Preview URL for a page id ("home" allowed). */
export function editorPreviewUrl(pageId: string): string {
  return `/informative/editor-preview?page=${encodeURIComponent(pageId)}`;
}
