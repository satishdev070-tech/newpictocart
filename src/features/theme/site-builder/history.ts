import type { ThemeConfig } from "@/features/theme/schema/config";

/**
 * Undo / redo for the site builder (pure). The builder keeps the whole theme document per step;
 * documents are small (≤ 256 KB) and structurally shared, so snapshots are cheap.
 *
 * Coalescing: consecutive edits with the same `coalesce` key (e.g. typing in one field) within
 * COALESCE_MS replace the latest step instead of adding one, so undo goes back a whole word/edit.
 * `saved` tracks the document last written to the draft, for the "unsaved changes" state.
 */

export const HISTORY_LIMIT = 100;
export const COALESCE_MS = 1000;

export type HistoryState = {
  past: ThemeConfig[];
  present: ThemeConfig;
  future: ThemeConfig[];
  /** The document as last saved (or loaded). */
  saved: ThemeConfig;
  lastKey: string | null;
  lastAt: number;
};

export type HistoryAction =
  | { type: "apply"; config: ThemeConfig; coalesce?: string; now?: number }
  | { type: "undo" }
  | { type: "redo" }
  /** After a successful save: `config` (the document that was sent) becomes the saved baseline. Edits made meanwhile stay. */
  | { type: "saved"; config?: ThemeConfig }
  /**
   * Discard local unsynced edits: restore `present` to the last `saved` baseline and clear
   * undo/redo. Does not touch drafts already written on the server.
   */
  | { type: "discard" }
  /** Replace everything (e.g. reload after a conflict). */
  | { type: "reset"; config: ThemeConfig };

export function initHistory(config: ThemeConfig): HistoryState {
  return { past: [], present: config, future: [], saved: config, lastKey: null, lastAt: 0 };
}

export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "apply": {
      if (action.config === state.present) return state;
      const now = action.now ?? Date.now();
      const merge = !!action.coalesce && action.coalesce === state.lastKey && now - state.lastAt < COALESCE_MS && state.past.length > 0;
      const past = merge ? state.past : [...state.past, state.present].slice(-HISTORY_LIMIT);
      return { ...state, past, present: action.config, future: [], lastKey: action.coalesce ?? null, lastAt: now };
    }
    case "undo": {
      const prev = state.past[state.past.length - 1];
      if (!prev) return state;
      return { ...state, past: state.past.slice(0, -1), present: prev, future: [state.present, ...state.future], lastKey: null };
    }
    case "redo": {
      const [next, ...rest] = state.future;
      if (!next) return state;
      return { ...state, past: [...state.past, state.present].slice(-HISTORY_LIMIT), present: next, future: rest, lastKey: null };
    }
    case "saved": {
      return { ...state, saved: action.config ?? state.present, lastKey: null };
    }
    case "discard": {
      if (state.present === state.saved && state.past.length === 0 && state.future.length === 0) return state;
      return { ...state, past: [], present: state.saved, future: [], lastKey: null, lastAt: 0 };
    }
    case "reset":
      return initHistory(action.config);
  }
}

export const canUndo = (s: HistoryState) => s.past.length > 0;
export const canRedo = (s: HistoryState) => s.future.length > 0;
export const isDirty = (s: HistoryState) => s.present !== s.saved && JSON.stringify(s.present) !== JSON.stringify(s.saved);
