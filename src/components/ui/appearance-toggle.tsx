"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { APPEARANCE_KEY, APPEARANCES, type Appearance } from "@/lib/appearance";
import { cn } from "@/lib/cn";

const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;
const LABELS = { light: "Light", dark: "Dark", system: "System" } as const;

function apply(pref: Appearance) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (dark) document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
}

function read(): Appearance {
  try {
    const v = localStorage.getItem(APPEARANCE_KEY);
    return (APPEARANCES as readonly string[]).includes(v ?? "") ? (v as Appearance) : "light";
  } catch {
    return "light";
  }
}

/** Light / Dark / System segmented control for the platform UI. Persists per browser. */
export function AppearanceToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const [pref, setPref] = useState<Appearance>("light");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser-only storage after mount
    setPref(read());
  }, []);
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);
  const choose = (p: Appearance) => {
    setPref(p);
    try {
      localStorage.setItem(APPEARANCE_KEY, p);
    } catch {
      /* storage unavailable: applies for this page only */
    }
    apply(p);
  };
  return (
    <div role="radiogroup" aria-label="Appearance" className={cn("inline-flex rounded-md border border-border bg-surface-secondary p-0.5", className)}>
      {APPEARANCES.map((p) => {
        const Icon = ICONS[p];
        const on = pref === p;
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={LABELS[p]}
            title={LABELS[p]}
            onClick={() => choose(p)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[5px] px-2 py-1 text-caption font-medium transition-colors",
              on ? "bg-surface text-accent shadow-xs" : "text-muted hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
            {compact ? null : LABELS[p]}
          </button>
        );
      })}
    </div>
  );
}

/** One-click light/dark switch for topbars (the full Light / Dark / System choice stays in the account menu). */
export function AppearanceQuickToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the applied theme after mount
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);
  const toggle = () => {
    const next: Appearance = dark ? "light" : "dark";
    try {
      localStorage.setItem(APPEARANCE_KEY, next);
    } catch {
      /* storage unavailable: applies for this page only */
    }
    apply(next);
    setDark(!dark);
  };
  const Icon = dark ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={cn("grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-secondary hover:text-foreground", className)}
    >
      <Icon aria-hidden className="size-[18px]" strokeWidth={1.75} />
    </button>
  );
}
