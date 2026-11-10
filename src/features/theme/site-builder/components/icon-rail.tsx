"use client";

import { FileText, Layers, Menu, Palette, Puzzle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { useBuilder, type Panel } from "../context";

type RailKind = "pages" | "menus" | "theme" | "embeds" | "layers";

const TOP: { kind: RailKind; label: string; icon: LucideIcon }[] = [
  { kind: "pages", label: "Pages", icon: FileText },
  { kind: "menus", label: "Menus", icon: Menu },
  { kind: "theme", label: "Theme settings", icon: Palette },
  { kind: "embeds", label: "Embed apps", icon: Puzzle },
];
const BOTTOM: { kind: RailKind; label: string; icon: LucideIcon }[] = [{ kind: "layers", label: "Layers", icon: Layers }];

/** Which rail entry a panel belongs to (popups live under Pages, section editing under Layers). */
export function railKindOf(panel: Panel | null): RailKind | null {
  if (!panel) return null;
  switch (panel.kind) {
    case "popup":
      return "pages";
    case "section":
    case "insert":
      return "layers";
    default:
      return panel.kind;
  }
}

/** Vertical icon rail on the left; clicking the active entry collapses the panel. */
export function IconRail() {
  const { panel, setPanel } = useBuilder();
  const active = railKindOf(panel);

  const item = ({ kind, label, icon: Icon }: (typeof TOP)[number]) => {
    const on = active === kind;
    return (
      <li key={kind}>
        <button
          type="button"
          aria-label={label}
          aria-pressed={on}
          title={label}
          onClick={() => setPanel(on && panel?.kind === kind ? null : ({ kind } as Panel))}
          className={cn(
            "relative flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 [&_svg]:size-5",
            on ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-secondary hover:text-foreground",
          )}
        >
          {on ? <span aria-hidden className="absolute -left-1.5 top-2 bottom-2 w-[3px] rounded-r-full bg-accent-strong" /> : null}
          <Icon aria-hidden />
          <span className="text-center">{label}</span>
        </button>
      </li>
    );
  };

  return (
    <nav aria-label="Builder tools" data-tour="builder-tools" className="flex w-[68px] shrink-0 flex-col justify-between border-r border-border bg-surface px-1.5 py-2">
      <ul className="space-y-1">{TOP.map(item)}</ul>
      <ul className="space-y-1 border-t border-border pt-2">{BOTTOM.map(item)}</ul>
    </nav>
  );
}
