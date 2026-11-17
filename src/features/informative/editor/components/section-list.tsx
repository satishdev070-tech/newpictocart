"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, GripVertical, MoreHorizontal, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { PageSection } from "../../sections";
import { SECTION_FIELDS } from "../fields";
import { MAX_SECTIONS } from "../state";

type Drag = { from: number; over: number; pointerId: number };

/** Index the pointer is over, from the rows' vertical midpoints. */
function overIndex(list: HTMLElement | null, clientY: number, fallback: number): number {
  if (!list) return fallback;
  const rows = [...list.querySelectorAll<HTMLElement>(":scope > li[data-row]")];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!.getBoundingClientRect();
    if (clientY < r.top + r.height / 2) return i;
  }
  return Math.max(0, rows.length - 1);
}

/** The ⋯ menu of a row: duplicate, delete (with a confirm step). */
function RowMenu({ label, onDuplicate, onDelete, canDuplicate }: { label: string; onDuplicate: () => void; onDelete: () => void; canDuplicate: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) {
        setOpen(false);
        setConfirm(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <Button type="button" size="sm" variant="ghost" aria-label={`More actions for ${label}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <MoreHorizontal aria-hidden />
      </Button>
      {open ? (
        <div role="menu" aria-label={`${label} actions`} className="absolute top-full right-0 z-20 mt-1 w-48 rounded-lg border border-border bg-surface p-1 shadow-lg">
          {confirm ? (
            <div className="space-y-2 p-2">
              <p className="text-small">Delete this section?</p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="danger" role="menuitem" autoFocus onClick={() => { setOpen(false); setConfirm(false); onDelete(); }}>
                  Delete
                </Button>
                <Button type="button" size="sm" variant="ghost" role="menuitem" onClick={() => setConfirm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <button type="button" role="menuitem" disabled={!canDuplicate} onClick={() => { setOpen(false); onDuplicate(); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-small hover:bg-surface-secondary disabled:opacity-50">
                <Copy aria-hidden className="size-4" /> Duplicate
              </button>
              <button type="button" role="menuitem" onClick={() => setConfirm(true)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-small text-error hover:bg-error/10">
                <Trash2 aria-hidden className="size-4" /> Delete
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** The page's sections: select, drag (or ↑/↓) to reorder, show/hide, duplicate, delete, add. */
export function SectionList({
  sections,
  selectedId,
  canWrite,
  onSelect,
  onMove,
  onToggle,
  onDuplicate,
  onDelete,
  onAdd,
  onAddAi,
}: {
  sections: PageSection[];
  selectedId: string | null;
  canWrite: boolean;
  onSelect: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onToggle: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onAddAi: () => void;
}) {
  const list = useRef<HTMLOListElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [announce, setAnnounce] = useState("");
  const full = sections.length >= MAX_SECTIONS;

  const start = (i: number) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!canWrite || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ from: i, over: i, pointerId: e.pointerId });
  };
  const move = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const over = overIndex(list.current, e.clientY, drag.from);
    if (over !== drag.over) setDrag({ ...drag, over });
  };
  const end = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (drag.over !== drag.from) {
      onMove(drag.from, drag.over);
      setAnnounce(`Moved to position ${drag.over + 1} of ${sections.length}.`);
    }
    setDrag(null);
  };
  const step = (i: number, d: -1 | 1) => {
    onMove(i, i + d);
    setAnnounce(`Moved to position ${i + d + 1} of ${sections.length}.`);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {sections.length === 0 ? (
          <p className="mx-2 my-6 rounded-lg border border-dashed border-border px-4 py-6 text-center text-small text-muted">This page has no sections yet. Add your first one below.</p>
        ) : null}
        <ol ref={list} aria-label="Sections on this page" className={cn("space-y-1", drag && "select-none")}>
          {sections.map((s, i) => {
            const meta = SECTION_FIELDS[s.type];
            const heading = typeof s.props.heading === "string" && s.props.heading.trim() ? s.props.heading.trim() : null;
            const selected = s.id === selectedId;
            const indicator = drag && drag.over === i && drag.from !== i ? (drag.over < drag.from ? "before" : "after") : null;
            return (
              <li
                key={s.id}
                data-row
                className={cn(
                  "group relative flex items-center gap-1 rounded-lg border px-1 py-1 transition-colors",
                  selected ? "border-accent bg-accent-soft/50" : "border-transparent hover:bg-surface-secondary",
                  drag?.from === i && "opacity-50",
                  indicator === "before" && "before:absolute before:inset-x-1 before:-top-1 before:h-0.5 before:rounded before:bg-accent",
                  indicator === "after" && "after:absolute after:inset-x-1 after:-bottom-1 after:h-0.5 after:rounded after:bg-accent",
                )}
              >
                {canWrite ? (
                  <button
                    type="button"
                    aria-label={`Drag to reorder ${meta.label}`}
                    title="Drag to reorder"
                    tabIndex={-1}
                    onPointerDown={start(i)}
                    onPointerMove={move}
                    onPointerUp={end}
                    onPointerCancel={() => setDrag(null)}
                    className="grid h-8 w-6 shrink-0 cursor-grab touch-none place-items-center rounded text-subtle hover:text-foreground active:cursor-grabbing"
                  >
                    <GripVertical aria-hidden className="size-4" />
                  </button>
                ) : null}
                <button type="button" onClick={() => onSelect(s.id)} aria-current={selected ? "true" : undefined} className={cn("min-w-0 flex-1 rounded-md px-1.5 py-1 text-left focus-visible:outline-2 focus-visible:outline-accent", !s.visible && "opacity-60")}>
                  <span className="block truncate text-small font-medium">{meta.label}</span>
                  {heading ? <span className="block truncate text-caption text-muted">{heading}</span> : null}
                  {!s.visible ? <span className="sr-only">(hidden)</span> : null}
                </button>
                {canWrite ? (
                  <span className="flex shrink-0 items-center opacity-100 lg:opacity-60 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
                    <Button type="button" size="sm" variant="ghost" className="px-1.5" aria-label={`Move ${meta.label} up`} disabled={i === 0} onClick={() => step(i, -1)}>
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="px-1.5" aria-label={`Move ${meta.label} down`} disabled={i === sections.length - 1} onClick={() => step(i, 1)}>
                      <ArrowDown aria-hidden />
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="px-1.5" aria-label={s.visible ? `Hide ${meta.label}` : `Show ${meta.label}`} aria-pressed={!s.visible} onClick={() => onToggle(s.id)}>
                      {s.visible ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
                    </Button>
                    <RowMenu label={meta.label} canDuplicate={!full} onDuplicate={() => onDuplicate(s.id)} onDelete={() => onDelete(s.id)} />
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>
      </div>
      {canWrite ? (
        <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
          <Button type="button" variant="secondary" onClick={onAdd} disabled={full}>
            <Plus aria-hidden /> Add section
          </Button>
          <Button type="button" variant="secondary" onClick={onAddAi} disabled={full}>
            <Sparkles aria-hidden className="text-accent" /> Add with AI
          </Button>
          {full ? <p className="col-span-2 text-caption text-muted">A page can have up to {MAX_SECTIONS} sections.</p> : null}
        </div>
      ) : (
        <p className="border-t border-border p-3 text-caption text-muted">You can view this page. Ask the owner for content access to edit it.</p>
      )}
    </div>
  );
}
