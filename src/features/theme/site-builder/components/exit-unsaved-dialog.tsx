"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";

/**
 * Native &lt;dialog&gt; leave gate for the site builder (focus trap + Escape = Cancel).
 * Primary saves the draft before exiting; secondary discards local unsynced edits only.
 */
export function ExitUnsavedDialog({
  open,
  saving,
  onSave,
  onDiscard,
  onCancel,
}: {
  open: boolean;
  /** True while Yes, save. is awaiting flush — blocks double-click and Cancel still closes. */
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onClose={() => {
        if (!saving) onCancel();
      }}
      onCancel={(e) => {
        // Escape: stay in the editor (native cancel). Prevent default close when flush is running.
        if (saving) e.preventDefault();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !saving) onCancel();
      }}
      className="m-auto w-[min(92vw,420px)] rounded-lg border border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/40"
    >
      {open ? (
        <div className="p-5">
          <h2 id={titleId} className="text-base font-semibold">
            Unsaved Changes
          </h2>
          <div id={bodyId} className="mt-2 space-y-2 text-sm text-muted">
            <p>Exiting without saving would cause you to lose the unsaved changes. Would you like to save the draft before exiting?</p>
            <p className="text-xs leading-relaxed">Discarding does not undo drafts already saved on the server.</p>
          </div>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={onDiscard}>
              No, I don&apos;t want to save.
            </Button>
            <Button type="button" variant="accent" size="sm" pending={saving} disabled={saving} onClick={onSave}>
              Yes, save.
            </Button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
