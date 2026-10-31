"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, MoreVertical, X } from "lucide-react";
import { HEX_COLOR_RE } from "@/features/theme/schema/primitives";
import { cn } from "@/lib/cn";
import { inputClassName } from "@/components/ui/field";

/** Native `<input type="color">` requires #rrggbb; never pass empty/invalid (throws in some browsers). */
function safePickerHex(raw: unknown): string {
  if (typeof raw !== "string") return "#ffffff";
  const v = raw.trim().toLowerCase();
  return HEX_COLOR_RE.test(v) ? v : "#ffffff";
}

/**
 * Small UI kit for the site builder panels. Uses the dashboard (orange panel) tokens:
 * bg-surface / border-border / text-muted / bg-accent / accent-soft.
 */

export const input = inputClassName;

/** Left-panel frame: title row with close (×) and an optional back action, scrolling body, optional footer. */
export function PanelFrame({ title, subtitle, onClose, onBack, footer, children }: { title: string; subtitle?: string; onClose?: () => void; onBack?: () => void; footer?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-14 items-center gap-2 border-b border-border px-3 py-2.5">
        {onBack ? (
          <IconButton label="Back" onClick={onBack} className="-ml-1">
            <ArrowLeft />
          </IconButton>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-body font-semibold leading-tight">{title}</h2>
          {subtitle ? <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p> : null}
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-muted transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            aria-label="Close panel"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
      {footer ? <div className="border-t border-border bg-surface p-3 shadow-[0_-6px_16px_-10px_rgba(0,0,0,0.18)]">{footer}</div> : null}
    </div>
  );
}

/** Uppercase group heading inside a panel, with an optional action on the right. */
export function PanelSection({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex min-h-7 items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Friendly empty state: icon, title, short text and an optional action. */
export function EmptyState({ icon, title, children, action, className }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface-secondary/50 px-4 py-6 text-center", className)}>
      {icon ? <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-accent [&_svg]:size-5">{icon}</span> : null}
      <p className="text-small font-semibold">{title}</p>
      {children ? <div className="max-w-60 text-xs leading-relaxed text-muted">{children}</div> : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export function FieldRow({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-muted">{hint}</p> : null}
    </div>
  );
}

/** Accessible on/off switch: an ON / OFF pill in the theme colour (native checkbox with role="switch"). */
export function Toggle({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <label htmlFor={fid} className="flex min-h-8 cursor-pointer items-center justify-between gap-3 text-small">
      <span className="min-w-0">{label}</span>
      <span className="relative inline-flex shrink-0">
        <input id={fid} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span
          aria-hidden
          className={cn(
            "relative block h-6 w-[52px] rounded-full transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40 peer-focus-visible:ring-offset-1 motion-reduce:transition-none",
            checked ? "bg-accent shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]" : "bg-surface-secondary ring-1 ring-inset ring-border-strong",
          )}
        >
          <span className={cn("absolute top-1/2 -translate-y-1/2 select-none text-[10px] font-bold tracking-wide", checked ? "left-2 text-accent-foreground" : "right-1.5 text-muted")}>{checked ? "ON" : "OFF"}</span>
          <span className={cn("absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-200 motion-reduce:transition-none", checked && "translate-x-7")} />
        </span>
      </span>
    </label>
  );
}

export function ColorInput({
  value,
  onChange,
  label,
  allowEmpty,
  onPointerActive,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  allowEmpty?: boolean;
  /** Optional: hold-autosave agent wires this to pause idle save during colour drag. */
  onPointerActive?: (held: boolean) => void;
}) {
  const id = useId();
  const valid = typeof value === "string" && HEX_COLOR_RE.test(value.trim()) ? value.trim().toLowerCase() : "";
  const pickerValue = safePickerHex(value);
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="color"
        value={pickerValue}
        onChange={(e) => onChange(e.target.value)}
        onPointerDown={onPointerActive ? () => onPointerActive(true) : undefined}
        onPointerUp={onPointerActive ? () => onPointerActive(false) : undefined}
        onPointerCancel={onPointerActive ? () => onPointerActive(false) : undefined}
        className="size-8 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent p-0.5 transition-colors hover:border-accent/50"
      />
      <label htmlFor={id} className="flex-1 text-small">
        {label}
      </label>
      <span className="font-mono text-xs text-muted">{valid || (allowEmpty ? "theme" : pickerValue)}</span>
      {allowEmpty && valid ? (
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
    <div
      {...rest}
      className={cn(
        "group flex min-h-11 items-center gap-1.5 rounded-xl border px-2 py-1.5 text-small transition-[border-color,box-shadow,background-color] duration-150",
        active ? "border-accent bg-accent-soft shadow-[0_0_0_3px_rgba(249,115,22,0.12)]" : "border-border bg-surface hover:border-border-strong hover:shadow-[0_2px_8px_-4px_rgba(0,0,0,0.15)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function IconButton({ label, onClick, children, className, disabled }: { label: string; onClick?: () => void; children: ReactNode; className?: string; disabled?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={cn(
        "grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-accent-soft hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4",
        className,
      )}>
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
      className={cn("m-auto w-[calc(100vw-2rem)] rounded-2xl border border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]", wide ? "max-w-3xl" : "max-w-lg")}
    >
      {open ? (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <h2 className="text-body font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-accent-soft hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
          {footer ? <div className="flex justify-end gap-2 rounded-b-2xl border-t border-border bg-surface-secondary/50 px-5 py-3">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}

/** Dropdown ⋮ menu (closes on outside click, Escape or a choice). */
export function MoreMenu({ items, label = "More actions" }: { items: { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean }[]; label?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => ref.current?.removeAttribute("open");
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close();
      ref.current?.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <details ref={ref} className="relative" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary
        aria-label={label}
        title={label}
        className={cn(
          "grid size-8 cursor-pointer list-none place-items-center rounded-lg text-muted transition-colors hover:bg-accent-soft hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 [&::-webkit-details-marker]:hidden",
          open && "bg-accent-soft text-accent",
        )}
      >
        <MoreVertical aria-hidden className="size-4" />
      </summary>
      <div role="menu" className="absolute right-0 z-30 mt-1 min-w-40 rounded-xl border border-border bg-surface p-1 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.25)]">
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
            className={cn(
              "flex h-8 w-full items-center rounded-lg px-2.5 text-left text-small transition-colors disabled:pointer-events-none disabled:opacity-40",
              it.danger ? "text-error hover:bg-error/10" : "hover:bg-accent-soft hover:text-accent",
            )}
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
      className: "grid h-7 w-5 shrink-0 cursor-grab select-none place-items-center rounded-md text-muted/70 transition-colors hover:bg-surface-secondary hover:text-foreground active:cursor-grabbing",
    }),
  };
}
