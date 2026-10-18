"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ChevronDown, ExternalLink, FileText, History, Monitor, Redo2, Smartphone, Undo2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import type { PublicError } from "@/lib/errors";
import { publishThemeAction, refreshPreviewUrlAction, rollbackThemeAction, saveThemeDraftAction } from "@/features/theme/actions";
import { useBuilder } from "../context";
import { PAGE_GROUP_LABELS, type PageGroup } from "../pages";
import { Dialog, IconButton, input } from "./ui";
import { previewUrlFor } from "./canvas-frame";

/** Set before a deliberate reload / navigation so the "unsaved changes" prompt is skipped. */
export const leaveGuard = { bypass: false };

const GROUP_ORDER: PageGroup[] = ["pages", "ecommerce", "members", "popups"];

type Notice = { tone: "ok" | "error"; text: string } | null;

function errorText(e: PublicError): string {
  return e.fieldErrors?._form?.[0] ?? Object.values(e.fieldErrors ?? {})[0]?.[0] ?? e.message;
}

/** Small anchored popover that closes on outside click / Escape. */
function Popover({ button, children, label }: { button: (open: boolean, toggle: () => void) => ReactNode; children: (close: () => void) => ReactNode; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {button(open, () => setOpen((o) => !o))}
      {open ? (
        <div role="dialog" aria-label={label} className="absolute right-0 z-40 mt-1.5 w-80 rounded-xl border border-border bg-surface p-2 shadow-lg">
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

export function TopBar() {
  const b = useBuilder();
  const router = useRouter();
  const [notice, setNotice] = useState<Notice>(null);
  const [saveErr, setSaveErr] = useState<PublicError | null>(null);
  const [saving, startSave] = useTransition();
  const [publishing, startPublish] = useTransition();
  const [restoring, startRestore] = useTransition();
  const [previewing, startPreview] = useTransition();
  const [publishOpen, setPublishOpen] = useState(false);
  const [note, setNote] = useState("");

  // Auto-hide success notices.
  useEffect(() => {
    if (notice?.tone !== "ok") return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  const conflict = saveErr?.code === "CONFLICT";

  const save = (force: boolean) =>
    startSave(async () => {
      const sent = b.config;
      const fd = new FormData();
      fd.set("config", JSON.stringify(sent));
      fd.set("baseUpdatedAt", b.baseUpdatedAt);
      if (force) fd.set("force", "1");
      const r = await saveThemeDraftAction(null, fd);
      if (r.ok) {
        b.markSaved(r.data.updatedAt, sent);
        setSaveErr(null);
        setNotice({ tone: "ok", text: "Draft saved." });
      } else {
        setSaveErr(r.error);
        setNotice({ tone: "error", text: errorText(r.error) });
      }
    });

  const publish = () =>
    startPublish(async () => {
      const fd = new FormData();
      if (note.trim()) fd.set("label", note.trim());
      const r = await publishThemeAction(null, fd);
      if (r.ok) {
        setPublishOpen(false);
        setNote("");
        setNotice({ tone: "ok", text: "Published. Your store is updated." });
        router.refresh();
      } else setNotice({ tone: "error", text: errorText(r.error) });
    });

  const restore = (id: string, version: number) => {
    const lose = b.dirty ? " Your unsaved changes will be lost." : "";
    if (!confirm(`Restore v${version}? It goes live on your store and replaces your draft.${lose}`)) return;
    startRestore(async () => {
      const fd = new FormData();
      fd.set("versionId", id);
      const r = await rollbackThemeAction(null, fd);
      if (!r.ok) return setNotice({ tone: "error", text: errorText(r.error) });
      // The draft was replaced on the server: reload the builder with it.
      leaveGuard.bypass = true;
      window.location.reload();
    });
  };

  const openPreview = () => {
    // Open the tab synchronously (popup blockers), then point it at a fresh preview entry URL.
    const tab = window.open("", "_blank");
    startPreview(async () => {
      const r = await refreshPreviewUrlAction();
      if (!r.ok) {
        tab?.close();
        return setNotice({ tone: "error", text: errorText(r.error) });
      }
      const url = previewUrlFor(r.data.url, b.store.origin, b.page.path);
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else window.open(url, "_blank", "noopener");
    });
  };

  const versions = b.history.filter((h) => h.status !== "draft");

  return (
    // No overflow clipping on the bar: the history popover and notices hang below it.
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
      <Link
        href="/dashboard"
        onClick={(e) => {
          if (b.dirty && !confirm("Leave the editor? Your unsaved changes will be lost.")) e.preventDefault();
        }}
        className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-muted hover:bg-surface-secondary hover:text-foreground [&_svg]:size-4"
        aria-label="Back to dashboard"
        title="Back to dashboard"
      >
        <ArrowLeft aria-hidden />
      </Link>
      <div className="hidden min-w-0 max-w-44 lg:block">
        <p className="truncate text-small font-semibold">{b.store.name}</p>
        <p className="flex items-center gap-1 text-xs text-muted">
          {b.dirty ? (
            <>
              <span className="size-1.5 rounded-full bg-accent" aria-hidden /> Unsaved changes
            </>
          ) : (
            "All changes saved"
          )}
        </p>
      </div>

      <label className="ml-1 flex shrink-0 items-center gap-1.5 text-small">
        <span className="hidden text-xs font-medium text-muted xl:inline">Page</span>
        <span className="relative block w-40 shrink-0 xl:w-48">
          <FileText aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
          {/* Explicit line-height / padding: the shared input's py-2 clipped the text at h-8 in some browsers. */}
          <select
            aria-label="Page"
            title={b.page.label}
            value={b.page.key}
            onChange={(e) => b.setPageKey(e.target.value)}
            className={cn(input, "h-8 w-full min-w-0 cursor-pointer appearance-none truncate rounded-lg py-0 pl-8 pr-7 text-small font-medium leading-8")}
          >
            {GROUP_ORDER.map((g) => {
              const items = b.pages.filter((p) => p.group === g);
              return items.length ? (
                <optgroup key={g} label={PAGE_GROUP_LABELS[g]}>
                  {items.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })}
          </select>
          <ChevronDown aria-hidden className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
        </span>
      </label>

      <div className="flex shrink-0 items-center gap-0.5 border-l border-border pl-2">
        <IconButton label="Undo (Ctrl/⌘ Z)" onClick={b.undo} disabled={!b.canUndo}>
          <Undo2 />
        </IconButton>
        <IconButton label="Redo (Shift ⌘ Z / Ctrl Y)" onClick={b.redo} disabled={!b.canRedo}>
          <Redo2 />
        </IconButton>
      </div>

      <div role="group" aria-label="Device" className="mx-auto flex shrink-0 items-center gap-0.5 rounded-xl bg-surface-secondary p-1">
        {(
          [
            ["desktop", "Desktop", Monitor],
            ["mobile", "Mobile", Smartphone],
          ] as const
        ).map(([d, label, Icon]) => (
          <button
            key={d}
            type="button"
            aria-pressed={b.device === d}
            aria-label={label}
            title={label}
            onClick={() => b.setDevice(d)}
            className={cn(
              "grid h-7 w-10 place-items-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 [&_svg]:size-4",
              b.device === d ? "bg-surface text-accent shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-muted hover:text-foreground",
            )}
          >
            <Icon aria-hidden />
          </button>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {b.issues.length ? (
          <span title={`${b.issues.length} stored setting(s) were invalid and will be dropped on save:\n${b.issues.slice(0, 5).join("\n")}`} className="text-warning [&_svg]:size-4">
            <AlertTriangle aria-label="Some stored settings are invalid" />
          </span>
        ) : null}

        <Popover
          label="Version history"
          button={(open, toggle) => (
            <IconButton label="Version history" onClick={toggle} className={open ? "bg-surface-secondary text-foreground" : undefined}>
              <History />
            </IconButton>
          )}
        >
          {() => (
            <div className="space-y-1">
              <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">Version history{b.publishedVersion ? ` · live v${b.publishedVersion}` : ""}</p>
              {versions.length ? (
                <ul className="max-h-80 space-y-1 overflow-y-auto">
                  {versions.map((h) => (
                    <li key={h.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-small hover:bg-surface-secondary">
                      <div className="min-w-0 flex-1">
                        <p className="truncate">
                          v{h.version}
                          {h.label ? ` · ${h.label}` : ""}
                          {h.status === "published" ? <span className="ml-1.5 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent">Live</span> : null}
                        </p>
                        <p className="text-xs text-muted">{new Date(h.publishedAt ?? h.updatedAt).toLocaleString()}</p>
                      </div>
                      {b.canPublish && h.status !== "published" ? (
                        <button type="button" disabled={restoring} onClick={() => restore(h.id, h.version)} className="text-xs font-medium text-accent hover:underline disabled:opacity-50">
                          Restore
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-1 py-2 text-small text-muted">Nothing published yet.</p>
              )}
            </div>
          )}
        </Popover>

        <Button variant="secondary" size="sm" onClick={openPreview} pending={previewing} title={b.dirty ? "Preview shows your saved draft. Save to preview your latest changes." : "Open the saved draft in a new tab"}>
          <ExternalLink aria-hidden /> <span className="hidden md:inline">Preview</span>
        </Button>
        <Button variant={conflict ? "danger" : "secondary"} size="sm" onClick={() => save(conflict)} pending={saving} disabled={!b.dirty && !saveErr} title={b.dirty ? "Save your changes as a draft" : "All changes saved"}>
          {b.dirty && !saving && !conflict ? <span aria-hidden className="size-1.5 rounded-full bg-accent-strong lg:hidden" /> : null}
          {conflict ? "Save anyway" : (
            <>
              Save<span className="hidden xl:inline">&nbsp;draft</span>
            </>
          )}
        </Button>
        {b.canPublish ? (
          <Button variant="accent" size="sm" onClick={() => setPublishOpen(true)} disabled={b.dirty || publishing} title={b.dirty ? "Save your draft before publishing" : "Publish the saved draft"}>
            Publish
          </Button>
        ) : null}
      </div>

      {notice ? (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          className={cn(
            "absolute right-3 top-full z-40 mt-2 flex max-w-md items-start gap-2 rounded-lg border px-3 py-2 text-small shadow-lg",
            notice.tone === "error" ? "border-error/40 bg-surface text-error" : "border-border bg-surface text-success",
          )}
        >
          <span className="flex-1">{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-xs text-muted hover:text-foreground" aria-label="Dismiss">
            ✕
          </button>
        </div>
      ) : null}

      <Dialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title="Publish theme"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button variant="accent" size="sm" onClick={publish} pending={publishing} disabled={b.dirty}>
              Publish
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-small text-muted">Your saved draft goes live on your store.</p>
          <label htmlFor="sb-publish-note" className="block text-xs font-medium">
            Version note (optional)
          </label>
          <input id="sb-publish-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} placeholder="e.g. Diwali homepage" className={input} />
        </div>
      </Dialog>
    </header>
  );
}
