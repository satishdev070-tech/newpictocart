import { sectionSchema, type PageSection, type SectionType } from "../sections";
import { newSectionId } from "../site/customize";

/**
 * Website editor state (pure reducer, unit tested). The page's sections plus an undo/redo history.
 * Typing into one field coalesces into a single history step (same `coalesce` key), so Undo
 * reverts a whole edit rather than one keystroke. `order` is always 0..n-1 in list order.
 */

export const HISTORY_LIMIT = 100;
export const MAX_SECTIONS = 40;

export type EditorState = {
  sections: PageSection[];
  selectedId: string | null;
  past: PageSection[][];
  future: PageSection[][];
  /** Key of the last coalescing edit ("<sectionId>.<field>"); null after any other change. */
  lastCoalesce: string | null;
  /** Serialized sections as last saved (or loaded). */
  savedJson: string;
};

export type EditorAction =
  | { type: "load"; sections: PageSection[] }
  | { type: "add"; sectionType: SectionType; index?: number }
  /** Inserts a ready section (AI); its id is replaced when taken. */
  | { type: "insert"; section: PageSection; index?: number }
  | { type: "move"; from: number; to: number }
  | { type: "duplicate"; id: string }
  | { type: "delete"; id: string }
  | { type: "toggle"; id: string }
  | { type: "setProp"; id: string; key: string; value: unknown; coalesce?: boolean }
  /** Replaces a section's props (AI rewrite); id, type and visibility stay. */
  | { type: "replaceProps"; id: string; props: Record<string, unknown> }
  | { type: "select"; id: string | null }
  | { type: "undo" }
  | { type: "redo" }
  /** The given serialized sections were saved. */
  | { type: "saved"; json: string };

const withOrder = (list: readonly PageSection[]): PageSection[] => list.map((s, i) => (s.order === i ? s : { ...s, order: i }));

/** Stable serialization for dirty checks and save snapshots. */
export function serializeSections(list: readonly PageSection[]): string {
  return JSON.stringify(list.map((s, i) => ({ id: s.id, type: s.type, props: s.props, order: i, visible: s.visible })));
}

export function initEditorState(sections: readonly PageSection[]): EditorState {
  const list = withOrder([...sections].sort((a, b) => a.order - b.order));
  return { sections: list, selectedId: null, past: [], future: [], lastCoalesce: null, savedJson: serializeSections(list) };
}

export const isDirty = (s: EditorState): boolean => serializeSections(s.sections) !== s.savedJson;
export const canUndo = (s: EditorState): boolean => s.past.length > 0;
export const canRedo = (s: EditorState): boolean => s.future.length > 0;

function commit(state: EditorState, sections: PageSection[], extra: Partial<EditorState> = {}, coalesce: string | null = null): EditorState {
  const next = withOrder(sections);
  const merge = coalesce !== null && coalesce === state.lastCoalesce && state.past.length > 0;
  const past = merge ? state.past : [...state.past, state.sections].slice(-HISTORY_LIMIT);
  return { ...state, ...extra, sections: next, past, future: [], lastCoalesce: coalesce };
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const indexOf = (state: EditorState, id: string) => state.sections.findIndex((s) => s.id === id);
const clampIndex = (i: number | undefined, len: number) => (i === undefined || !Number.isInteger(i) ? len : Math.max(0, Math.min(len, i)));

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "load":
      return initEditorState(action.sections);
    case "add": {
      if (state.sections.length >= MAX_SECTIONS) return state;
      const section: PageSection = { id: newSectionId(action.sectionType, state.sections.map((s) => s.id)), type: action.sectionType, props: {}, order: 0, visible: true };
      const list = [...state.sections];
      list.splice(clampIndex(action.index, list.length), 0, section);
      return commit(state, list, { selectedId: section.id });
    }
    case "insert": {
      if (state.sections.length >= MAX_SECTIONS) return state;
      const parsed = sectionSchema.safeParse(action.section);
      if (!parsed.success) return state;
      const taken = state.sections.map((s) => s.id);
      const id = taken.includes(parsed.data.id) ? newSectionId(parsed.data.type, taken) : parsed.data.id;
      const section = { ...parsed.data, id, visible: true };
      const list = [...state.sections];
      list.splice(clampIndex(action.index, list.length), 0, section);
      return commit(state, list, { selectedId: id });
    }
    case "move": {
      const { from, to } = action;
      const n = state.sections.length;
      if (from === to || from < 0 || from >= n || to < 0 || to >= n) return state;
      const list = [...state.sections];
      const [item] = list.splice(from, 1);
      list.splice(to, 0, item!);
      return commit(state, list);
    }
    case "duplicate": {
      const i = indexOf(state, action.id);
      if (i < 0 || state.sections.length >= MAX_SECTIONS) return state;
      const src = state.sections[i]!;
      const copy: PageSection = { ...src, id: newSectionId(src.type, state.sections.map((s) => s.id)), props: clone(src.props) };
      const list = [...state.sections];
      list.splice(i + 1, 0, copy);
      return commit(state, list, { selectedId: copy.id });
    }
    case "delete": {
      const i = indexOf(state, action.id);
      if (i < 0) return state;
      return commit(
        state,
        state.sections.filter((s) => s.id !== action.id),
        { selectedId: state.selectedId === action.id ? null : state.selectedId },
      );
    }
    case "toggle": {
      const i = indexOf(state, action.id);
      if (i < 0) return state;
      return commit(state, state.sections.map((s, j) => (j === i ? { ...s, visible: !s.visible } : s)));
    }
    case "setProp": {
      const i = indexOf(state, action.id);
      if (i < 0 || !action.key || action.key.length > 60) return state;
      const s = state.sections[i]!;
      const props = { ...s.props };
      if (action.value === undefined) delete props[action.key];
      else props[action.key] = action.value;
      return commit(state, state.sections.map((x, j) => (j === i ? { ...x, props } : x)), {}, action.coalesce ? `${action.id}.${action.key}` : null);
    }
    case "replaceProps": {
      const i = indexOf(state, action.id);
      if (i < 0) return state;
      return commit(state, state.sections.map((x, j) => (j === i ? { ...x, props: { ...action.props } } : x)));
    }
    case "select":
      return action.id === null || indexOf(state, action.id) >= 0 ? { ...state, selectedId: action.id, lastCoalesce: null } : state;
    case "undo": {
      const prev = state.past[state.past.length - 1];
      if (!prev) return state;
      const selectedId = state.selectedId && prev.some((s) => s.id === state.selectedId) ? state.selectedId : null;
      return { ...state, sections: prev, past: state.past.slice(0, -1), future: [state.sections, ...state.future].slice(0, HISTORY_LIMIT), lastCoalesce: null, selectedId };
    }
    case "redo": {
      const [next, ...rest] = state.future;
      if (!next) return state;
      const selectedId = state.selectedId && next.some((s) => s.id === state.selectedId) ? state.selectedId : null;
      return { ...state, sections: next, past: [...state.past, state.sections].slice(-HISTORY_LIMIT), future: rest, lastCoalesce: null, selectedId };
    }
    case "saved":
      return { ...state, savedJson: action.json, lastCoalesce: null };
  }
}
