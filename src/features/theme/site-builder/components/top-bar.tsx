"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ChevronDown, ExternalLink, FileText, History, Monitor, Redo2, Smartphone, Undo2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import type { PublicError } from "@/lib/errors";
import { publishThemeAction, refreshPreviewUrlAction, rollbackThemeAction, saveThemeDraftAction } from "@/features/theme/actions";
import { AUTOSAVE_IDLE_MS, AUTOSAVE_MAX_WAIT_MS, autosaveMaxWaitDelayMs, draftStatusLabel, isStaleDraftConflict, shouldScheduleAutosave } from "../autosave";
import { useBuilder } from "../context";
import { leaveDecision, shouldGateLeave } from "../leave-gate";
import { PAGE_GROUP_LABELS, type PageGroup } from "../pages";
import { ExitUnsavedDialog } from "./exit-unsaved-dialog";
import { Dialog, IconButton, input } from "./ui";
import { previewUrlFor } from "./canvas-frame";

/** Set before a deliberate reload / navigation so the "unsaved changes" prompt is skipped. */
export const leaveGuard = { bypass: false };

const DASHBOARD_HREF = "/dashboard";
const GROUP_ORDER: PageGroup[] = ["pages", "ecommerce", "members", "popups"];

type Notice =
  | { tone: "ok" | "pending"; text: string }
  | { tone: "error"; text: string; conflict?: boolean }
  | null;

type LeaveIntent = { kind: "href"; href: string } | { kind: "history" };

function errorText(e: PublicError): string {
  return e.fieldErrors?._form?.[0] ?? Object.values(e.fieldErrors ?? {})[0]?.[0] ?? e.message;
}

function waitMs(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
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
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveIntent, setLeaveIntent] = useState<LeaveIntent | null>(null);
  const [leaveFlushing, setLeaveFlushing] = useState(false);
  const savingRef = useRef(false);
  const dirtyRef = useRef(b.dirty);
  const configRef = useRef(b.config);
  const baseRef = useRef(b.baseUpdatedAt);
  const dirtySinceRef = useRef<number | null>(null);
  const conflict = isStaleDraftConflict(saveErr?.code);

  useLayoutEffect(() => {
    dirtyRef.current = b.dirty;
    configRef.current = b.config;
    baseRef.current = b.baseUpdatedAt;
  }, [b.dirty, b.config, b.baseUpdatedAt]);

  // Module-level bypass survives SPA remounts; clear on each editor open.
  useEffect(() => {
    leaveGuard.bypass = false;
  }, []);

  // Auto-hide success notices (pending / conflict stay until resolved).
  useEffect(() => {
    if (notice?.tone !== "ok") return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  /**
   * Persist the current local document as the server draft (manual Save, autosave, or exit flush).
   * Returns true on success. Never call from colour/slider/`apply` handlers; canvas already paints
   * from local history before this runs.
   */
  const persistDraft = (force: boolean, source: "manual" | "auto" | "flush"): Promise<boolean> => {
    if (savingRef.current) return Promise.resolve(false);
    savingRef.current = true;
    // Capture at fire time — edits during the round-trip stay dirty for the next pass.
    const sent = configRef.current;
    const baseUpdatedAt = baseRef.current;
    const saveGeneration = b.captureSaveGeneration();
    return new Promise((resolve) => {
      startSave(async () => {
        let ok = false;
        try {
          const fd = new FormData();
          fd.set("config", JSON.stringify(sent));
          fd.set("baseUpdatedAt", baseUpdatedAt);
          if (force) fd.set("force", "1");
          const r = await saveThemeDraftAction(null, fd);
          if (r.ok) {
            const accepted = b.markSaved(r.data.updatedAt, sent, saveGeneration);
            if (accepted) {
              setSaveErr(null);
              if (source !== "flush") {
                setNotice({ tone: "ok", text: source === "auto" ? "Draft autosaved." : "Draft saved." });
              }
            }
            ok = true;
          } else {
            setSaveErr(r.error);
            const stale = isStaleDraftConflict(r.error.code);
            setNotice({
              tone: "error",
              conflict: stale,
              text: stale
                ? "Someone else saved this theme after you opened it. Reload to see their draft, or save anyway to keep yours."
                : errorText(r.error),
            });
            ok = false;
          }
        } catch {
          ok = false;
          setNotice({ tone: "error", text: "Could not save the draft. Check your connection and try again." });
        } finally {
          savingRef.current = false;
          resolve(ok);
        }
      });
    });
  };

  /**
   * Forced flush for exit / leave: wait out any in-flight save, then persist while still dirty.
   * Returns true when the local document is clean (or was already clean).
   */
  const flushDraft = async (force = false): Promise<boolean> => {
    // Wait briefly for an in-flight autosave/manual save to finish.
    const deadline = Date.now() + AUTOSAVE_MAX_WAIT_MS;
    while (savingRef.current && Date.now() < deadline) {
      await waitMs(40);
    }
    if (savingRef.current) return false;

    // Up to a few passes: edits during a flush stay dirty and need another persist.
    for (let pass = 0; pass < 3; pass++) {
      if (!dirtyRef.current) return true;
      const sent = configRef.current;
      const ok = await persistDraft(force, "flush");
      if (!ok) return false;
      // markSaved is sync but React dirty may lag one frame — treat identity match as clean.
      if (configRef.current === sent) {
        dirtyRef.current = false;
        return true;
      }
      dirtyRef.current = true;
    }
    return !dirtyRef.current;
  };

  const saveManual = (force: boolean) => {
    void persistDraft(force, "manual");
  };

  const navigateAway = (intent: LeaveIntent) => {
    leaveGuard.bypass = true;
    setLeaveOpen(false);
    setLeaveIntent(null);
    if (intent.kind === "href") {
      router.push(intent.href);
      return;
    }
    window.history.back();
  };

  /** Central leave helper: prompt when dirty or saving; otherwise navigate. */
  const requestLeave = (intent: LeaveIntent) => {
    if (leaveDecision({ dirty: dirtyRef.current, saving: savingRef.current || saving, bypass: leaveGuard.bypass }) === "proceed") {
      navigateAway(intent);
      return;
    }
    setLeaveIntent(intent);
    setLeaveOpen(true);
  };

  const onLeaveSave = async () => {
    if (leaveFlushing || !leaveIntent) return;
    setLeaveFlushing(true);
    try {
      const ok = await flushDraft(conflict);
      if (ok && !dirtyRef.current) {
        navigateAway(leaveIntent);
        return;
      }
      // Stay open with the error notice from persistDraft.
    } finally {
      setLeaveFlushing(false);
    }
  };

  const onLeaveDiscard = () => {
    if (leaveFlushing || !leaveIntent) return;
    b.discardLocalEdits();
    setSaveErr(null);
    navigateAway(leaveIntent);
  };

  const onLeaveCancel = () => {
    if (leaveFlushing) return;
    setLeaveOpen(false);
    setLeaveIntent(null);
  };

  // Latest dirty/conflict for the idle / max-wait timers (effect-event may only run from effects).
  const autosaveNow = useEffectEvent(() => {
    if (!shouldScheduleAutosave({ dirty: dirtyRef.current, conflict: isStaleDraftConflict(saveErr?.code), saving: savingRef.current })) {
      return;
    }
    void persistDraft(false, "auto");
  });

  // Track the start of a continuous dirty streak for max-wait flush.
  useEffect(() => {
    if (!b.dirty || conflict) {
      dirtySinceRef.current = null;
      return;
    }
    if (dirtySinceRef.current == null) dirtySinceRef.current = Date.now();
  }, [b.dirty, conflict, b.config]);

  // Debounced autosave: idle after local edits, plus max-wait so long sessions sync without only idle.
  useEffect(() => {
    if (!shouldScheduleAutosave({ dirty: b.dirty, conflict, saving })) return;
    const idleTimer = window.setTimeout(() => autosaveNow(), AUTOSAVE_IDLE_MS);
    const maxDelay = autosaveMaxWaitDelayMs(dirtySinceRef.current, Date.now(), AUTOSAVE_MAX_WAIT_MS);
    const maxTimer = maxDelay == null ? undefined : window.setTimeout(() => autosaveNow(), maxDelay);
    return () => {
      window.clearTimeout(idleTimer);
      if (maxTimer != null) window.clearTimeout(maxTimer);
    };
  }, [b.dirty, b.config, conflict, saving]);

  // beforeunload only while dirty or saving (tab close / hard reload).
  useEffect(() => {
    if (!shouldGateLeave({ dirty: b.dirty, saving })) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      if (leaveGuard.bypass) return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [b.dirty, saving]);

  // Browser Back: re-push and open the dialog (no useBlocker in this Next tree).
  useEffect(() => {
    if (!shouldGateLeave({ dirty: b.dirty, saving })) return;
    const onPopState = () => {
      if (leaveGuard.bypass) return;
      window.history.pushState({ siteBuilderLeave: 1 }, "", window.location.href);
      setLeaveIntent({ kind: "history" });
      setLeaveOpen(true);
    };
    window.history.pushState({ siteBuilderLeave: 1 }, "", window.location.href);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [b.dirty, saving]);

  const reloadAfterConflict = () => {
    leaveGuard.bypass = true;
    window.location.reload();
  };

  const publish = () => {
    // Close the dialog immediately so the canvas stays usable; show a pending toast.
    const label = note.trim();
    setPublishOpen(false);
    setNote("");
    setNotice({ tone: "pending", text: "Publishing…" });
    startPublish(async () => {
      const fd = new FormData();
      if (label) fd.set("label", label);
      const r = await publishThemeAction(null, fd);
      if (r.ok) {
        setNotice({ tone: "ok", text: "Published. Your store is updated." });
        router.refresh();
      } else setNotice({ tone: "error", text: errorText(r.error) });
    });
  };

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
  const status = draftStatusLabel({ dirty: b.dirty, saving, publishing, conflict });

  return (
    // No overflow clipping on the bar: the history popover and notices hang below it.
    <header data-tour="builder-topbar" className="relative z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
      <Link
        href={DASHBOARD_HREF}
        onClick={(e) => {
          e.preventDefault();
          requestLeave({ kind: "href", href: DASHBOARD_HREF });
        }}
        className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-muted hover:bg-surface-secondary hover:text-foreground [&_svg]:size-4"
        aria-label="Back to dashboard"
        title="Back to dashboard"
      >
        <ArrowLeft aria-hidden />
      </Link>
      <div className="hidden min-w-0 max-w-52 lg:block">
        <p className="truncate text-small font-semibold">{b.store.name}</p>
        <p className="flex items-center gap-1 text-xs text-muted" aria-live="polite">
          {conflict ? (
            <>
              <span className="size-1.5 rounded-full bg-error" aria-hidden /> {status}
            </>
          ) : b.dirty || saving ? (
            <>
              <span className={cn("size-1.5 rounded-full", saving ? "animate-pulse bg-muted" : "bg-accent")} aria-hidden /> {status}
            </>
          ) : publishing ? (
            <>
              <span className="size-1.5 animate-pulse rounded-full bg-accent" aria-hidden /> {status}
            </>
          ) : (
            status
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
            className={cn(input, "h-8 w-full min-w-0 cursor-pointer appearance-none truncate rounded-lg !py-0 pl-8 pr-7 text-small font-medium leading-[30px]")}
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
        <Button
          variant={conflict ? "danger" : "secondary"}
          size="sm"
          onClick={() => saveManual(conflict)}
          pending={saving}
          disabled={!b.dirty && !saveErr}
          title={conflict ? "Overwrite the server draft with your local changes" : b.dirty ? "Save your changes as a draft (also autosaves after a short pause)" : "All changes saved"}
        >
          {b.dirty && !saving && !conflict ? <span aria-hidden className="size-1.5 rounded-full bg-accent-strong lg:hidden" /> : null}
          {conflict ? (
            "Save anyway"
          ) : (
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
          key="builder-draft-notice"
          role={notice.tone === "error" ? "alert" : "status"}
          className={cn(
            "absolute right-3 top-full z-40 mt-2 flex max-w-md items-start gap-2 rounded-lg border px-3 py-2 text-small shadow-lg",
            notice.tone === "error" ? "border-error/40 bg-surface text-error" : notice.tone === "pending" ? "border-border bg-surface text-foreground" : "border-border bg-surface text-success",
          )}
        >
          <span className="flex-1">{notice.text}</span>
          {notice.tone === "error" && notice.conflict ? (
            <span className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={reloadAfterConflict} className="text-xs font-medium text-foreground underline-offset-2 hover:underline">
                Reload
              </button>
              <button type="button" onClick={() => saveManual(true)} className="text-xs font-medium text-error underline-offset-2 hover:underline">
                Save anyway
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setNotice(null)} className="text-xs text-muted hover:text-foreground" aria-label="Dismiss">
              ✕
            </button>
          )}
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

      <ExitUnsavedDialog open={leaveOpen} saving={leaveFlushing} onSave={() => void onLeaveSave()} onDiscard={onLeaveDiscard} onCancel={onLeaveCancel} />
    </header>
  );
}
