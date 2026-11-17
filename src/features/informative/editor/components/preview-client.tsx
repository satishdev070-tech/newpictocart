"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PageSection } from "../../sections";
import { InformativeSite } from "../../site/renderer";
import type { SiteView } from "../../site/view";
import type { ThemeConfig } from "../../themes/types";
import { SECTION_FIELDS } from "../fields";
import { isTrustedOrigin, parseEditorMessage, previewSelectMessage, readyMessage, renderedMessage } from "../protocol";

/**
 * The Website editor's preview (inside its iframe). Renders the real site renderer with the
 * editor's UNSAVED sections, received over postMessage (validated by protocol.ts), without
 * reloading. Hover outlines a section; a click selects it in the editor instead of following
 * links or submitting forms. Nothing here writes data.
 */

const WRAPPERS = "#if-main > div[data-section]";

const STYLE = `
[data-editor-id]{position:relative;cursor:pointer}
[data-editor-id]:empty{min-height:72px;margin:8px 16px;border:2px dashed #94a3b8;border-radius:10px;display:flex;align-items:center;justify-content:center}
[data-editor-id]:empty::before{content:attr(data-editor-empty);font:500 14px/1.4 system-ui,sans-serif;color:#64748b;padding:12px;text-align:center}
[data-editor-id][data-editor-hover]::after,[data-editor-id][data-editor-selected]::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:60}
[data-editor-id][data-editor-hover]::after{outline:2px dashed #6366f1;outline-offset:-2px}
[data-editor-id][data-editor-selected]::after{outline:3px solid #4f46e5;outline-offset:-3px}
`;

export function EditorPreview({ theme, view, initialSections, pageTitle, fontClassName }: { theme: ThemeConfig; view: SiteView; initialSections: PageSection[]; pageTitle: string | null; fontClassName?: string }) {
  const [sections, setSections] = useState(initialSections);
  const [rev, setRev] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // Messages from the editor (parent window, same origin only).
  useEffect(() => {
    if (window.parent === window) return;
    const onMessage = (e: MessageEvent) => {
      if (!isTrustedOrigin(e.origin, window.location.origin) || e.source !== window.parent) return;
      const msg = parseEditorMessage(e.data);
      if (!msg) return;
      if (msg.type === "state") {
        setSections(msg.sections);
        setRev(msg.rev);
      } else setSelectedId(msg.id);
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage(readyMessage(), window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Tag each rendered section wrapper with its id: the renderer's data-section-id when present,
  // otherwise by position (SectionList renders the visible sections in order).
  useLayoutEffect(() => {
    const visible = sections.filter((s) => s.visible);
    const byId = new Map(visible.map((s) => [s.id, s]));
    const nodes = root.current?.querySelectorAll<HTMLElement>(WRAPPERS) ?? [];
    nodes.forEach((el, i) => {
      const s = (el.dataset.sectionId ? byId.get(el.dataset.sectionId) : undefined) ?? visible[i];
      if (!s) return;
      el.dataset.editorId = s.id;
      el.dataset.editorEmpty = `${SECTION_FIELDS[s.type].label}: ${SECTION_FIELDS[s.type].emptyHint ?? "nothing to show yet."}`;
      if (s.id === selectedId) el.dataset.editorSelected = "";
      else delete el.dataset.editorSelected;
    });
    if (rev && window.parent !== window) window.parent.postMessage(renderedMessage(rev), window.location.origin);
  }, [sections, selectedId, rev]);

  // Scroll the selected section into view.
  useEffect(() => {
    if (!selectedId) return;
    const el = root.current?.querySelector<HTMLElement>(`[data-editor-id="${CSS.escape(selectedId)}"]`);
    el?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
  }, [selectedId]);

  // Hover outline + click to select; links and forms never navigate in the editor.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let hovered: HTMLElement | null = null;
    const over = (e: PointerEvent) => {
      const t = (e.target as Element | null)?.closest<HTMLElement>("[data-editor-id]") ?? null;
      if (t === hovered) return;
      if (hovered) delete hovered.dataset.editorHover;
      hovered = t;
      if (t) t.dataset.editorHover = "";
    };
    const leave = () => {
      if (hovered) delete hovered.dataset.editorHover;
      hovered = null;
    };
    const click = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const interactive = target?.closest("a, button, summary, input, select, textarea, label");
      if (interactive?.matches("a, button[type=submit]")) e.preventDefault();
      const section = target?.closest<HTMLElement>("[data-editor-id]");
      const id = section?.dataset.editorId;
      if (!id) return;
      if (interactive?.matches("summary")) return; // FAQ open/close keeps working
      e.preventDefault();
      setSelectedId(id);
      window.parent.postMessage(previewSelectMessage(id), window.location.origin);
    };
    const submit = (e: SubmitEvent) => e.preventDefault();
    el.addEventListener("pointerover", over);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("click", click, true);
    el.addEventListener("submit", submit, true);
    return () => {
      el.removeEventListener("pointerover", over);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("click", click, true);
      el.removeEventListener("submit", submit, true);
    };
  }, []);

  return (
    <div ref={root}>
      <style>{STYLE}</style>
      <InformativeSite theme={theme} view={view} sections={sections} pageTitle={pageTitle} fontClassName={fontClassName} />
    </div>
  );
}
