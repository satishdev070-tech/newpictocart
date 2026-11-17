"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { PhotoTradeContext } from "../../media/image-picker";
import { useRouter } from "next/navigation";
import { ExternalLink, LogOut, Monitor, Palette, Redo2, Rocket, Smartphone, Undo2 } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { PageSection, PageType } from "../../sections";
import { setSiteStatusAction } from "../../actions";
import { saveEditorPageAction } from "../actions";
import { fieldProblems, type SelectOption } from "../fields";
import { editorPreviewUrl, isTrustedOrigin, parsePreviewMessage, selectMessage, stateMessage } from "../protocol";
import { canRedo, canUndo, editorReducer, initEditorState, isDirty, serializeSections } from "../state";
import { AddWithAiDialog, SectionLibraryDialog } from "./dialogs";
import { PreviewFrame, type Device } from "./preview-frame";
import { SectionList } from "./section-list";
import { SettingsPanel } from "./settings-panel";
import { actionErrorText } from "./util";

export type EditorPageRef = { id: string; type: PageType; title: string; isPublished: boolean };

type Props = {
  /** The site's trade ("Dental clinic"), so the image picker's Unsplash search starts on-topic. */
  photoTrade?: string;
  page: { id: string; type: PageType; title: string; updatedAt: string };
  pages: EditorPageRef[];
  initialSections: PageSection[];
  services: SelectOption[];
  canWrite: boolean;
  canTheme: boolean;
  canPublish: boolean;
  status: "DRAFT" | "PUBLISHED";
  liveUrl: string;
  theme: { name: string; colors: string[] };
};

const PREVIEW_DEBOUNCE_MS = 250;
const LEAVE_MESSAGE = "You have unsaved changes. Leave without saving?";

function useIsSmall(): boolean {
  const [small, setSmall] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const on = () => setSmall(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return small;
}

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

/**
 * Website editor: full screen, top bar (page, device, undo/redo, save, publish, exit), Sections /
 * Theme panel on the left, live preview on the right. Edits stay in the browser (pure reducer with
 * history) and reach the preview over postMessage; Save writes the page's sections (content.write).
 */
export function WebsiteEditor({ page, pages, initialSections, services, canWrite, canTheme, canPublish, status: initialStatus, liveUrl, theme, photoTrade = "" }: Props) {
  const router = useRouter();
  const [state, dispatch] = useReducer(editorReducer, initialSections, initEditorState);
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);
  const dirty = isDirty(state);
  const selected = state.sections.find((s) => s.id === state.selectedId) ?? null;

  const [tab, setTab] = useState<"sections" | "theme">("sections");
  const [device, setDevice] = useState<Device>("desktop");
  const [mobileView, setMobileView] = useState<"edit" | "preview">("preview");
  const small = useIsSmall();
  const [library, setLibrary] = useState(false);
  const [aiAdd, setAiAdd] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(page.updatedAt);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState<{ tone: "error" | "success" | "info"; text: string; conflict?: boolean } | null>(null);
  const [problems, setProblems] = useState<Record<string, string>>({});

  // ---- Preview channel --------------------------------------------------------------------------
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const rev = useRef(0);
  const post = useCallback((msg: unknown) => {
    const w = frame.current?.contentWindow;
    if (w) w.postMessage(msg, window.location.origin);
  }, []);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!isTrustedOrigin(e.origin, window.location.origin) || !frame.current || e.source !== frame.current.contentWindow) return;
      const msg = parsePreviewMessage(e.data);
      if (!msg) return;
      if (msg.type === "ready") {
        setReady(true);
        rev.current += 1;
        post(stateMessage(rev.current, latest.current.sections));
        post(selectMessage(latest.current.selectedId));
      } else if (msg.type === "select") {
        dispatch({ type: "select", id: msg.id });
        setTab("sections");
        setMobileView("edit");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [post]);

  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => {
      rev.current += 1;
      post(stateMessage(rev.current, state.sections));
    }, PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [state.sections, ready, post]);

  useEffect(() => {
    if (ready) post(selectMessage(state.selectedId));
  }, [state.selectedId, ready, post]);

  // ---- Leaving with unsaved changes -------------------------------------------------------------
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const confirmLeave = useCallback(() => !isDirty(latest.current) || window.confirm(LEAVE_MESSAGE), []);

  // ---- Save / publish ---------------------------------------------------------------------------
  const save = useCallback(async (): Promise<boolean> => {
    if (!canWrite) return false;
    const current = latest.current;
    const found = fieldProblems(current.sections);
    setProblems(found);
    if (Object.keys(found).length) {
      setMessage({ tone: "error", text: "A button link isn't valid. Fix the highlighted link and save again." });
      const id = Object.keys(found)[0]!.split(".")[0]!;
      dispatch({ type: "select", id });
      setTab("sections");
      setMobileView("edit");
      return false;
    }
    const json = serializeSections(current.sections);
    setSaving(true);
    setMessage(null);
    try {
      const r = await saveEditorPageAction({ pageId: page.id, sections: current.sections, expectedUpdatedAt: updatedAt });
      if (r.ok) {
        setUpdatedAt(r.data.updatedAt);
        dispatch({ type: "saved", json });
        setMessage({ tone: "success", text: status === "PUBLISHED" ? "Saved. Your live website is updated." : "Saved." });
        return true;
      }
      if (r.error.code === "CONFLICT") {
        setMessage({ tone: "error", conflict: true, text: "This page was changed somewhere else (another tab, the Customizer or a teammate) since you opened it. Reload to get the latest version; your unsaved edits here will be lost." });
      } else setMessage({ tone: "error", text: actionErrorText(r.error) });
      return false;
    } catch {
      setMessage({ tone: "error", text: "Couldn't save. Check your connection and try again." });
      return false;
    } finally {
      setSaving(false);
    }
  }, [canWrite, page.id, updatedAt, status]);

  async function publish() {
    if (isDirty(latest.current) && !(await save())) return;
    setPublishing(true);
    try {
      const fd = new FormData();
      fd.set("status", "PUBLISHED");
      const r = await setSiteStatusAction(null, fd);
      if (r.ok) {
        setStatus("PUBLISHED");
        setMessage({ tone: "success", text: "Your website is live." });
      } else setMessage({ tone: "error", text: actionErrorText(r.error) });
    } catch {
      setMessage({ tone: "error", text: "Couldn't publish. Check your connection and try again." });
    } finally {
      setPublishing(false);
    }
  }

  // ---- Keyboard shortcuts -----------------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "s") {
        e.preventDefault();
        void save();
      } else if ((k === "z" || k === "y") && !isTyping(e.target) && !document.querySelector("dialog[open]")) {
        e.preventDefault();
        dispatch({ type: k === "y" || e.shiftKey ? "redo" : "undo" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  const insertIndex = useMemo(() => {
    const i = state.sections.findIndex((s) => s.id === state.selectedId);
    return i >= 0 ? i + 1 : state.sections.length;
  }, [state.sections, state.selectedId]);

  const go = (href: string) => {
    if (confirmLeave()) {
      // The guard already asked: skip the browser's own unload prompt.
      dispatch({ type: "saved", json: serializeSections(latest.current.sections) });
      router.push(href);
    }
  };

  const effectiveDevice: Device = small ? "mobile" : device;
  const statusText = saving ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved";

  return (
    <PhotoTradeContext.Provider value={photoTrade}>
    <div className="fixed inset-0 z-40 flex flex-col bg-surface-secondary text-foreground">
      {/* ---- Top bar ---- */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-2 sm:px-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => go("/informative/dashboard")} aria-label="Exit editor">
          <LogOut aria-hidden className="rotate-180" /> <span className="hidden sm:inline">Exit</span>
        </Button>
        <label htmlFor="editor-page" className="sr-only">
          Page
        </label>
        <select
          id="editor-page"
          value={page.id}
          onChange={(e) => {
            const id = e.target.value;
            if (id !== page.id) {
              if (confirmLeave()) go(`/informative/editor?page=${encodeURIComponent(id)}`);
              else e.target.value = page.id;
            }
          }}
          className="h-9 max-w-[9.5rem] min-w-0 rounded-md border border-border bg-surface px-2 text-small font-medium sm:max-w-56"
        >
          {pages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
              {p.isPublished ? "" : " (hidden)"}
            </option>
          ))}
        </select>
        <div role="group" aria-label="Preview size" className="ml-1 hidden rounded-lg border border-border p-0.5 lg:flex">
          {(["desktop", "mobile"] as const).map((d) => (
            <button key={d} type="button" aria-pressed={device === d} onClick={() => setDevice(d)} className={cn("grid h-8 w-9 place-items-center rounded-md", device === d ? "bg-surface-secondary text-foreground" : "text-muted hover:text-foreground")}>
              {d === "desktop" ? <Monitor aria-hidden className="size-4" /> : <Smartphone aria-hidden className="size-4" />}
              <span className="sr-only">{d === "desktop" ? "Desktop" : "Mobile"}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center">
          <Button type="button" variant="ghost" size="sm" className="px-2" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!canUndo(state)} onClick={() => dispatch({ type: "undo" })}>
            <Undo2 aria-hidden />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="px-2" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo(state)} onClick={() => dispatch({ type: "redo" })}>
            <Redo2 aria-hidden />
          </Button>
        </div>
        <span className="ml-auto hidden items-center gap-1.5 text-caption text-muted md:inline-flex" aria-live="polite">
          <span aria-hidden className={cn("size-2 rounded-full", dirty ? "bg-warning" : "bg-success")} />
          {statusText}
        </span>
        <span className="sr-only md:hidden" aria-live="polite">
          {statusText}
        </span>
        <div className="ml-auto flex items-center gap-1.5 md:ml-2">
          {canWrite ? (
            <Button type="button" size="sm" variant={dirty ? "primary" : "secondary"} pending={saving} disabled={!dirty || publishing} onClick={() => void save()} title={status === "PUBLISHED" ? "Saving updates your live website" : undefined}>
              {dirty ? <span aria-hidden className="size-1.5 rounded-full bg-warning md:hidden" /> : null}
              Save
            </Button>
          ) : null}
          {status === "PUBLISHED" ? (
            <a href={liveUrl} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "ghost", size: "sm", className: "px-2 sm:px-3" })}>
              <ExternalLink aria-hidden /> <span className="hidden sm:inline">Live site</span>
            </a>
          ) : canPublish ? (
            <Button type="button" size="sm" variant="accent" pending={publishing} disabled={saving} onClick={() => void publish()} aria-label="Publish website">
              <Rocket aria-hidden /> <span className="hidden sm:inline">Publish</span>
            </Button>
          ) : null}
        </div>
      </header>

      {message ? (
        <div role={message.tone === "error" ? "alert" : "status"} className={cn("flex shrink-0 items-start gap-3 border-b px-4 py-2 text-small", message.tone === "error" ? "border-error/30 bg-error/10 text-error" : "border-success/25 bg-success/10 text-success")}>
          <p className="flex-1">{message.text}</p>
          {message.conflict ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => { dispatch({ type: "saved", json: serializeSections(latest.current.sections) }); window.location.reload(); }}>
              Reload
            </Button>
          ) : null}
          <button type="button" className="text-caption underline" onClick={() => setMessage(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1">
        {/* ---- Left panel (bottom sheet on phones) ---- */}
        <aside
          aria-label="Editor"
          className={cn(
            "flex min-h-0 flex-col border-border bg-surface",
            "lg:static lg:w-[360px] lg:shrink-0 lg:border-r",
            "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-14 max-lg:z-30 max-lg:h-[72dvh] max-lg:rounded-t-2xl max-lg:border-t max-lg:shadow-2xl",
            small && mobileView === "preview" && "max-lg:hidden",
          )}
        >
          <div role="tablist" aria-label="Editor panels" className="flex shrink-0 gap-1 border-b border-border px-3 pt-2">
            {(["sections", "theme"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                id={`tab-${t}`}
                aria-selected={tab === t}
                aria-controls={`panel-${t}`}
                onClick={() => setTab(t)}
                className={cn("-mb-px border-b-2 px-3 py-2 text-small font-medium", tab === t ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground")}
              >
                {t === "sections" ? "Sections" : "Theme"}
              </button>
            ))}
          </div>
          <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex min-h-0 flex-1 flex-col">
            {tab === "theme" ? (
              <ThemeTab theme={theme} canTheme={canTheme} go={go} />
            ) : selected ? (
              <SettingsPanel
                key={selected.id}
                pageId={page.id}
                section={selected}
                services={services}
                problems={problems}
                canWrite={canWrite}
                onBack={() => dispatch({ type: "select", id: null })}
                onProp={(key, value, typing) => dispatch({ type: "setProp", id: selected.id, key, value, coalesce: typing })}
                onReplaceProps={(props) => dispatch({ type: "replaceProps", id: selected.id, props })}
                onConfirmLeave={() => {
                  if (!confirmLeave()) return false;
                  dispatch({ type: "saved", json: serializeSections(latest.current.sections) });
                  return true;
                }}
              />
            ) : (
              <SectionList
                sections={state.sections}
                selectedId={state.selectedId}
                canWrite={canWrite}
                onSelect={(id) => dispatch({ type: "select", id })}
                onMove={(from, to) => dispatch({ type: "move", from, to })}
                onToggle={(id) => dispatch({ type: "toggle", id })}
                onDuplicate={(id) => dispatch({ type: "duplicate", id })}
                onDelete={(id) => dispatch({ type: "delete", id })}
                onAdd={() => setLibrary(true)}
                onAddAi={() => setAiAdd(true)}
              />
            )}
          </div>
        </aside>

        {/* ---- Preview ---- */}
        <main aria-label="Preview" className="min-w-0 flex-1 p-2 pb-16 lg:p-3">
          <PreviewFrame src={editorPreviewUrl(page.id)} device={effectiveDevice} frameRef={frame} ready={ready} />
        </main>
      </div>

      {/* ---- Phone toggle ---- */}
      <nav aria-label="Editor view" className="fixed inset-x-0 bottom-0 z-40 grid h-14 grid-cols-2 gap-2 border-t border-border bg-surface p-2 lg:hidden">
        {(["edit", "preview"] as const).map((v) => (
          <button key={v} type="button" aria-pressed={mobileView === v} onClick={() => setMobileView(v)} className={cn("rounded-lg text-small font-medium", mobileView === v ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-foreground")}>
            {v === "edit" ? "Sections" : "Preview"}
          </button>
        ))}
      </nav>

      <SectionLibraryDialog
        open={library}
        onClose={() => setLibrary(false)}
        onPick={(type) => {
          dispatch({ type: "add", sectionType: type, index: insertIndex });
          setLibrary(false);
          setTab("sections");
        }}
      />
      <AddWithAiDialog open={aiAdd} onClose={() => setAiAdd(false)} pageId={page.id} onSection={(section) => dispatch({ type: "insert", section, index: insertIndex })} />
    </div>
    </PhotoTradeContext.Provider>
  );
}

/** Theme tab: design, colours, fonts and logo live in the Customizer (its own preview and save). */
function ThemeTab({ theme, canTheme, go }: { theme: Props["theme"]; canTheme: boolean; go: (href: string) => void }) {
  return (
    <div className="space-y-4 overflow-y-auto p-4">
      <div className="rounded-lg border border-border p-4">
        <p className="text-caption text-muted">Current design</p>
        <p className="mt-0.5 text-body font-semibold">{theme.name}</p>
        <div className="mt-3 flex gap-1.5" aria-hidden>
          {theme.colors.map((c, i) => (
            <span key={`${c}-${i}`} className="size-7 rounded-full border border-border" style={{ background: c }} />
          ))}
        </div>
      </div>
      {canTheme ? (
        <>
          <p className="text-small text-muted">Change the design, colours, fonts, logo, favicon and hero image in the Customizer. Save your page here first.</p>
          <div className="grid gap-2">
            <Button type="button" variant="secondary" onClick={() => go("/informative/customize")}>
              <Palette aria-hidden /> Colours, fonts &amp; logo
            </Button>
            <Button type="button" variant="ghost" onClick={() => go("/informative/appearance")}>
              Switch design
            </Button>
          </div>
        </>
      ) : (
        <p className="text-small text-muted">Ask the owner for design access to change colours, fonts or the logo.</p>
      )}
    </div>
  );
}
