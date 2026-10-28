"use client";

import { useEffect } from "react";
import { BuilderProvider, useBuilder, type BuilderData } from "../context";
import { TopBar, leaveGuard } from "./top-bar";
import { IconRail } from "./icon-rail";
import { PanelHost } from "./panel-host";
import { CanvasFrame } from "./canvas-frame";

/**
 * The full-screen site builder (client root). Covers the dashboard shell:
 *   top bar (pages, undo / redo, device, preview, save, publish, history)
 *   body = icon rail | left panel (collapsible) | canvas (the storefront in an iframe).
 */
export function SiteBuilder({ data }: { data: BuilderData }) {
  return (
    <BuilderProvider data={data}>
      <Shell />
    </BuilderProvider>
  );
}

/** True when the keyboard event comes from a text field (keep native undo there). */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const type = (target as HTMLInputElement).type;
  return !["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"].includes(type);
}

function Shell() {
  const { undo, redo, canUndo, canRedo, dirty, panel } = useBuilder();

  // Undo / redo shortcuts (not while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        if (!canUndo) return;
        e.preventDefault();
        undo();
      } else if ((k === "z" && e.shiftKey) || (k === "y" && e.ctrlKey && !e.metaKey)) {
        if (!canRedo) return;
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, canUndo, canRedo]);

  // Warn before closing / reloading the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      if (leaveGuard.bypass) return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background text-foreground">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <IconRail />
        {panel ? (
          <aside aria-label="Editor panel" className="relative z-10 w-80 shrink-0 border-r border-border bg-surface shadow-[4px_0_16px_-12px_rgba(0,0,0,0.2)]">
            <PanelHost />
          </aside>
        ) : null}
        <main data-tour="builder-canvas" className="min-w-0 flex-1">
          <CanvasFrame />
        </main>
      </div>
    </div>
  );
}
