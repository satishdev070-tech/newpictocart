"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconGlyph } from "@/lib/icons/icon-glyph";
import { ICON_CATEGORIES, iconLabel, type IconCategoryId, type IconName } from "@/lib/icons/names";

export type IconEntry = { name: IconName; category: IconCategoryId; categoryLabel: string };

const ALL_ICONS: IconEntry[] = ICON_CATEGORIES.flatMap((c) => c.icons.map((name) => ({ name, category: c.id, categoryLabel: c.label })));
export const ICON_COUNT = ALL_ICONS.length;

/** Icons matching a search term (name words and category label) and category, in the given order. */
export function filterIcons(q: string, category: IconCategoryId | "", sort: "category" | "name"): IconEntry[] {
  const terms = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const list = ALL_ICONS.filter((i) => {
    if (category && i.category !== category) return false;
    const hay = `${i.name.replace(/-/g, " ")} ${i.categoryLabel.toLowerCase()}`;
    return terms.every((t) => hay.includes(t));
  });
  return sort === "name" ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : list;
}

/** Icons tab of the media picker: grid or list of allowlisted lucide icons (single choice). */
export function IconGrid({ icons, view, selected, onSelect }: { icons: IconEntry[]; view: "grid" | "list"; selected: IconName | null; onSelect: (entry: IconEntry) => void }) {
  if (!icons.length) {
    return (
      <div className="py-16 text-center">
        <p className="text-h3">No icons match</p>
        <p className="mt-1 text-small text-muted">Try “truck”, “gift”, “leaf” or “phone”.</p>
      </div>
    );
  }
  if (view === "list") {
    return (
      <ul className="divide-y divide-border rounded-lg ring-1 ring-border" data-asset-list>
        {icons.map((i) => {
          const on = selected === i.name;
          return (
            <li key={i.name}>
              <button
                type="button"
                data-asset
                aria-pressed={on}
                aria-label={`Select icon ${iconLabel(i.name)}`}
                onClick={() => onSelect(i)}
                className={cn("flex w-full items-center gap-3 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent", on ? "bg-accent-soft" : "hover:bg-surface-secondary")}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-secondary text-foreground">
                  <IconGlyph name={i.name} className="size-5" />
                </span>
                <span className="min-w-0 flex-1 truncate text-small font-medium">{iconLabel(i.name)}</span>
                <span className="hidden text-caption text-muted sm:block">{i.categoryLabel}</span>
                {on ? <Check aria-hidden className="size-4 text-accent" strokeWidth={3} /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2" data-asset-list>
      {icons.map((i) => {
        const on = selected === i.name;
        return (
          <li key={i.name}>
            <button
              type="button"
              data-asset
              aria-pressed={on}
              aria-label={`Select icon ${iconLabel(i.name)}`}
              title={iconLabel(i.name)}
              onClick={() => onSelect(i)}
              className={cn(
                "relative flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-lg bg-surface p-2 ring-1 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                on ? "bg-accent-soft text-accent ring-2 ring-accent" : "text-foreground ring-border hover:ring-border-strong",
              )}
            >
              <IconGlyph name={i.name} className="size-7" />
              <span className="w-full truncate text-center text-[11px] text-muted">{iconLabel(i.name)}</span>
              {on ? (
                <span className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-accent text-accent-foreground">
                  <Check aria-hidden className="size-2.5" strokeWidth={3} />
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
