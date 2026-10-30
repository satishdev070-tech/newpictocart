"use client";

import { createContext, useCallback, useContext, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import type { ThemeConfig } from "@/features/theme/schema/config";
import type { ThemeMenu } from "@/features/theme/schema/links";
import type { SiteMode } from "@/features/stores/site-mode";
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
 *
 * Local-first: `apply()` is synchronous — history dispatch only — so colour/slider/text edits
 * paint the canvas on the next React commit. Persistence is Save draft (manual or debounced
 * autosave in top-bar) then explicit Publish; neither path is awaited inside `apply()`.
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
  | { kind: "section"; ref: SectionRef; tab: SectionTab; textRole?: "heading" | "subheading" | "body" | "cta" | "eyebrow"; itemIndex?: number }
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
  /** Informative sites don't expose commerce-only pages in the editor. */
  siteMode?: SiteMode;
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
  // Stable apply identity: colour/slider handlers must not recreate `apply` every stroke
  // (avoids effect/subscription churn while paint stays sync via dispatch).
  const presentRef = useRef(config);
  presentRef.current = config;
  const apply = useCallback<BuilderApi["apply"]>((next, coalesce) => {
    const value = typeof next === "function" ? next(presentRef.current) : next;
    dispatch({ type: "apply", config: value, coalesce });
  }, []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  const markSaved = useCallback<BuilderApi["markSaved"]>((updatedAt, savedConfig) => {
    setBase(updatedAt);
    dispatch({ type: "saved", config: savedConfig });
  }, []);
  const setPageKeyAndClear = useCallback((k: string) => {
    setPageKey(k);
    select(null);
  }, []);

  const pages = useMemo(() => builderPages(config, data.pageSources, data.siteMode), [config, data.pageSources, data.siteMode]);
  const page = pages.find((p) => p.key === pageKey) ?? pages[0]!;

  const api: BuilderApi = {
    ...data,
    config,
    apply,
    undo,
    redo,
    canUndo: canUndo(hist),
    canRedo: canRedo(hist),
    dirty: isDirty(hist),
    markSaved,
    baseUpdatedAt,
    pages,
    page,
    setPageKey: setPageKeyAndClear,
    panel,
    setPanel,
    selected,
    select,
    device,
    setDevice,
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
