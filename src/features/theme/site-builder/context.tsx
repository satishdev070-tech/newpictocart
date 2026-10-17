"use client";

import { createContext, useCallback, useContext, useMemo, useReducer, useState, type ReactNode } from "react";
import type { ThemeConfig } from "@/features/theme/schema/config";
import type { ThemeMenu } from "@/features/theme/schema/links";
import type { EditorPickers, ThemeVersionSummary } from "@/features/theme/server/queries";
import { canRedo, canUndo, historyReducer, initHistory, isDirty } from "./history";
import { builderPages, type BuilderPage, type PageSources } from "./pages";
import type { ListKey } from "./slots";

/**
 * Site builder state shared by every panel (client). One provider per builder:
 *  - the theme document with undo / redo (history.ts), dirty tracking against the saved draft;
 *  - the current page (canvas path), the open left panel, the selected section, the device.
 * Panels never talk to the canvas directly: they `apply()` a new document and the canvas host
 * (components/canvas-frame.tsx) posts it to the iframe.
 */

export type SectionRef = { list: ListKey; sectionId: string };
export type SectionTab = "edit" | "design" | "settings" | "colors";

export type Panel =
  | { kind: "pages" }
  | { kind: "menus" }
  | { kind: "theme" }
  | { kind: "embeds" }
  | { kind: "layers" }
  | { kind: "popup"; popupId: string }
  | { kind: "section"; ref: SectionRef; tab: SectionTab }
  /** "+" picker: add a section to `list` before/after `anchorId` (null = end). ai = "Add with AI". */
  | { kind: "insert"; list: ListKey; anchorId: string | null; where: "before" | "after"; ai: boolean };

export type BuilderData = {
  initial: ThemeConfig;
  draftUpdatedAt: string | null;
  pickers: EditorPickers;
  history: ThemeVersionSummary[];
  publishedVersion: number | null;
  canPublish: boolean;
  issues: string[];
  store: { name: string; slug: string; origin: string; whatsapp: string | null };
  /** Database menus as theme menus (copied into the theme on first edit), by handle. */
  dbMenus: Record<string, ThemeMenu>;
  pageSources: PageSources;
  /** AI providers configured (for "Add with AI"). */
  aiEnabled: boolean;
};

export type BuilderApi = BuilderData & {
  config: ThemeConfig;
  /** Apply a new document (undoable). `coalesce` merges rapid edits of the same field into one step. */
  apply: (next: ThemeConfig | ((c: ThemeConfig) => ThemeConfig), coalesce?: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
  /** Call after a successful draft save with the document that was sent. */
  markSaved: (updatedAt: string, savedConfig?: ThemeConfig) => void;
  baseUpdatedAt: string;
  pages: BuilderPage[];
  page: BuilderPage;
  setPageKey: (key: string) => void;
  panel: Panel | null;
  setPanel: (p: Panel | null) => void;
  selected: SectionRef | null;
  select: (ref: SectionRef | null) => void;
  device: "desktop" | "mobile";
  setDevice: (d: "desktop" | "mobile") => void;
};

const Ctx = createContext<BuilderApi | null>(null);

export function useBuilder(): BuilderApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBuilder() outside <BuilderProvider>");
  return v;
}

export function BuilderProvider({ data, children }: { data: BuilderData; children: ReactNode }) {
  const [hist, dispatch] = useReducer(historyReducer, data.initial, initHistory);
  const [baseUpdatedAt, setBase] = useState(data.draftUpdatedAt ?? "");
  const [pageKey, setPageKey] = useState("home");
  const [panel, setPanel] = useState<Panel | null>({ kind: "pages" });
  const [selected, select] = useState<SectionRef | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  const config = hist.present;
  const apply = useCallback<BuilderApi["apply"]>(
    (next, coalesce) => {
      const value = typeof next === "function" ? next(config) : next;
      dispatch({ type: "apply", config: value, coalesce });
    },
    [config],
  );
  const pages = useMemo(() => builderPages(config, data.pageSources), [config, data.pageSources]);
  const page = pages.find((p) => p.key === pageKey) ?? pages[0]!;

  const api: BuilderApi = {
    ...data,
    config,
    apply,
    undo: () => dispatch({ type: "undo" }),
    redo: () => dispatch({ type: "redo" }),
    canUndo: canUndo(hist),
    canRedo: canRedo(hist),
    dirty: isDirty(hist),
    markSaved: (updatedAt, savedConfig) => {
      setBase(updatedAt);
      dispatch({ type: "saved", config: savedConfig });
    },
    baseUpdatedAt,
    pages,
    page,
    setPageKey: (k) => {
      setPageKey(k);
      select(null);
    },
    panel,
    setPanel,
    selected,
    select,
    device,
    setDevice,
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
