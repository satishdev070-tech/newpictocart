"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { inputClassName } from "@/components/ui/field";

/**
 * Small UI kit for the site builder panels. Uses the dashboard (orange panel) tokens:
 * bg-surface / border-border / text-muted / bg-accent / accent-soft.
 */

export const input = inputClassName;

/** Left-panel frame: title row with close (×) and an optional back action, scrolling body, optional footer. */
export function PanelFrame({ title, subtitle, onClose, onBack, footer, children }: { title: string; subtitle?: string; onClose?: () => void; onBack?: () => void; footer?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        {onBack ? (
          <button type="button" onClick={onBack} className="rounded-md px-1.5 py-0.5 text-small text-muted hover:bg-surface-secondary" aria-label="Back">
            ←
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-small font-semibold uppercase tracking-wide">{title}</h2>
          {subtitle ? <p className="truncate text-xs text-muted">{subtitle}</p> : null}
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} className="grid size-7 place-items-center rounded-full border border-border text-muted hover:bg-surface-secondary" aria-label="Close panel">
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
      {footer ? <div className="border-t border-border p-3">{footer}</div> : null}
    </div>
  );
}

export function FieldRow({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-xs font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/** Accessible on/off switch. */
export function Toggle({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <label htmlFor={fid} className="flex cursor-pointer items-center justify-between gap-3 text-small">
      <span>{label}</span>
      <span className="relative inline-flex">
        <input id={fid} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-5 w-9 rounded-full bg-border transition peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40" />
        <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

export function ColorInput({ value, onChange, label, allowEmpty }: { value: string; onChange: (v: string) => void; label: string; allowEmpty?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <input id={id} type="color" value={value || "#ffffff"} onChange={(e) => onChange(e.target.value)} className="size-8 cursor-pointer rounded-md border border-border bg-transparent p-0.5" />
      <label htmlFor={id} className="flex-1 text-small">
        {label}
      </label>
      <span className="font-mono text-xs text-muted">{value || "theme"}</span>
      {allowEmpty && value ? (
        <button type="button" onClick={() => onChange("")} className="text-xs text-accent hover:underline">
          Reset
        </button>
      ) : null}
    </div>
  );
}

/** List row used by Pages / Menus / Layers / Manage list. */
export function Row({ active, children, className, ...rest }: { active?: boolean; children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-2 text-small", active ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-border-strong", className)}>
      {children}
    </div>
  );
}

export function IconButton({ label, onClick, children, className, disabled }: { label: string; onClick?: () => void; children: ReactNode; className?: string; disabled?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={cn("grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-secondary hover:text-foreground disabled:opacity-40 [&_svg]:size-4", className)}>
      {children}
    </button>
  );
}

/** Modal dialog (native <dialog>, closes on Escape / backdrop). */
export function Dialog({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn("m-auto w-[calc(100vw-2rem)] rounded-xl border border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/50", wide ? "max-w-3xl" : "max-w-lg")}
    >
      {open ? (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-body font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="grid size-7 place-items-center rounded-full text-muted hover:bg-surface-secondary" aria-label="Close">
              <X className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
          {footer ? <div className="flex justify-end gap-2 border-t border-border px-4 py-3">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}

/** Dropdown ⋮ menu. */
export function MoreMenu({ items, label = "More actions" }: { items: { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean }[]; label?: string }) {
  return (
    <details className="relative">
      <summary aria-label={label} title={label} className="grid size-7 cursor-pointer list-none place-items-center rounded-md text-muted hover:bg-surface-secondary [&::-webkit-details-marker]:hidden">
        ⋮
      </summary>
      <div role="menu" className="absolute right-0 z-30 mt-1 min-w-36 rounded-lg border border-border bg-surface p-1 shadow-lg">
        {items.map((it) => (
          <button
            key={it.label}
            type="button"
            role="menuitem"
            disabled={it.disabled}
            onClick={(e) => {
              (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
              it.onSelect();
            }}
            className={cn("block w-full rounded-md px-2.5 py-1.5 text-left text-small hover:bg-surface-secondary disabled:opacity-40", it.danger && "text-error")}
          >
            {it.label}
          </button>
        ))}
      </div>
    </details>
  );
}

/**
 * Simple pointer drag-to-reorder for vertical lists. Spread `handleProps(i)` on the drag handle
 * and `itemProps(i)` on each row; `onMove(from, to)` fires on drop.
 */
export function useReorder(onMove: (from: number, to: number) => void) {
  const from = useRef<number | null>(null);
  return {
    itemProps: (i: number) => ({
      onDragOver: (e: React.DragEvent) => {
        if (from.current !== null) e.preventDefault();
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        if (from.current !== null && from.current !== i) onMove(from.current, i);
        from.current = null;
      },
    }),
    handleProps: (i: number) => ({
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        from.current = i;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(i));
      },
      onDragEnd: () => {
        from.current = null;
      },
      "aria-label": "Drag to reorder",
      title: "Drag to reorder",
      className: "cursor-grab select-none px-0.5 text-muted active:cursor-grabbing",
    }),
  };
}
