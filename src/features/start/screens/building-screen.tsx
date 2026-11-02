"use client";

import { useEffect, useRef, useState } from "react";
import { findTheme } from "@/features/marketing-site/themes";
import { ThemeDevicePreview } from "@/features/marketing-site/components/theme-card";
import { ThemeMockup } from "@/features/theme/marketplace/mockup";
import { moodById } from "../moods";
import { startCopy } from "../copy";
import type { StartDraft } from "../draft/schema";

/** Soft progress ceiling while signed-in finalize is in flight. */
export const BUILDING_SOFT_CAP = 92;
/** Wall-clock ms to reach softCap (unsigned journeys continue to 100%). */
export const BUILDING_PROGRESS_MS = 4200;
/** Delay between sequenced status messages. */
export const BUILDING_STEP_MS = 700;

/** Map elapsed ms → percent, capped while waiting on finalize. */
export function buildingProgressPct(elapsedMs: number, waitForFinalize: boolean): number {
  const softCap = waitForFinalize ? BUILDING_SOFT_CAP : 100;
  return Math.min(softCap, Math.round((elapsedMs / BUILDING_PROGRESS_MS) * softCap));
}

/** Active step index for the sequenced building messages. */
export function buildingStepIndex(elapsedMs: number, stepCount: number): number {
  if (stepCount <= 0) return 0;
  return Math.min(stepCount - 1, Math.floor(elapsedMs / BUILDING_STEP_MS));
}

export function BuildingScreen({
  draft,
  rootDomain: _rootDomain,
  onComplete,
  /** When true (signed-in finalize in flight), never claim 100% / call onComplete until the parent navigates away. */
  waitForFinalize = false,
}: {
  draft: StartDraft;
  rootDomain: string;
  onComplete: () => void;
  waitForFinalize?: boolean;
}) {
  void _rootDomain;
  const c = startCopy(draft.locale);
  const [step, setStep] = useState(0);
  const [pct, setPct] = useState(0);
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const stepCount = c.building.steps.length;

  const theme = draft.theme ? findTheme(draft.theme) : undefined;
  const mood = moodById(draft.mood);
  const accent = draft.accent || mood?.accentA || theme?.preset.colors.primary || "#F97316";
  const accentSoft = mood?.accentB || `${accent}33`;
  const storeLabel =
    draft.business.name.trim() ||
    draft.voice.facts.name?.trim() ||
    theme?.name.split(" ")[0] ||
    c.building.themeFallback;

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    doneRef.current = false;
    const start = Date.now();
    let finish: number | undefined;
    const tick = window.setInterval(() => {
      const elapsed = Date.now() - start;
      setStep(buildingStepIndex(elapsed, stepCount));
      const p = buildingProgressPct(elapsed, waitForFinalize);
      setPct(p);
      if (!waitForFinalize && p >= 100) {
        window.clearInterval(tick);
        finish = window.setTimeout(() => {
          if (!doneRef.current) {
            doneRef.current = true;
            onCompleteRef.current();
          }
        }, 280);
      }
    }, 80);
    return () => {
      window.clearInterval(tick);
      if (finish !== undefined) window.clearTimeout(finish);
    };
  }, [draft.locale, stepCount, waitForFinalize]);

  return (
    <section className="grid gap-8 lg:grid-cols-2 lg:items-center">
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-[0.14em] uppercase" style={{ color: accent }}>
            Pictocart
          </p>
          <h2 className="font-brand text-3xl sm:text-4xl">{c.building.title}</h2>
        </div>

        <ul className="space-y-2.5">
          {c.building.steps.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li
                key={label}
                className={[
                  "flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm transition-all duration-500",
                  active
                    ? "border-transparent bg-white/90 shadow-sm"
                    : done
                      ? "border-transparent bg-white/50"
                      : "border-[#2A2233]/06 bg-transparent opacity-55",
                ].join(" ")}
                style={active ? { boxShadow: `0 12px 28px -18px ${accent}` } : undefined}
              >
                <span
                  className="grid size-7 place-items-center rounded-full text-xs font-semibold"
                  style={
                    done || active
                      ? { background: `${accent}22`, color: accent }
                      : { background: "#2A223310", color: "#94A3B8" }
                  }
                >
                  {done ? "✓" : active ? "●" : "○"}
                </span>
                <span className={active ? "font-semibold text-[#2A2233]" : "text-[#5E5568]"}>{label}</span>
              </li>
            );
          })}
        </ul>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div
              className="h-2.5 flex-1 overflow-hidden rounded-full"
              style={{ background: accentSoft }}
            >
              <div
                className="h-full rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${accent}, ${mood?.accentB || accent})`,
                }}
              />
            </div>
            <span className="min-w-[3ch] text-sm font-mono text-[#6B6275]">{pct}%</span>
          </div>
          {waitForFinalize ? (
            <p className="text-sm text-[#6B6275]">{c.building.finishing}</p>
          ) : null}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[28px] border border-white/90 bg-white/75 p-3 shadow-[0_24px_60px_-28px_rgba(42,34,51,0.35)] sm:p-4">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background: `radial-gradient(ellipse at 30% 20%, ${accent}33, transparent 55%), radial-gradient(ellipse at 80% 90%, ${mood?.bg || "#FFF4E8"}, transparent 50%)`,
          }}
          aria-hidden
        />
        <div className="relative space-y-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#2A2233]">
                {theme?.name ?? c.building.themeFallback}
              </p>
              <p className="truncate text-xs text-[#6B6275]">{storeLabel}</p>
            </div>
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ background: `${accent}18`, color: accent }}
            >
              Live preview
            </span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[#2A2233]/08 bg-white">
            {theme ? (
              <div className="max-h-[420px] overflow-hidden sm:max-h-[520px]">
                <ThemeDevicePreview theme={theme} size="large" eager />
              </div>
            ) : (
              <div className="grid min-h-[280px] place-items-center bg-[#FFF7ED]/60 p-6 text-sm text-[#6B6275] sm:min-h-[360px]">
                <div className="w-full max-w-sm overflow-hidden rounded-xl border border-[#2A2233]/08">
                  <ThemeMockup
                    preset={{
                      colors: {
                        primary: accent,
                        secondary: mood?.accentB || "#FDBA74",
                        background: mood?.bg || "#FFF4E8",
                        foreground: "#2A2233",
                        muted: "#6B6275",
                        accent,
                        border: "#2A223318",
                      },
                      fonts: { heading: "inherit", body: "inherit" },
                      radius: "1rem",
                      layout: { heroStyle: "full", productCard: "soft", nav: "simple" },
                    }}
                    name={storeLabel}
                    tagline={draft.business.tagline.trim() || "Your storefront"}
                    themeKey="building-fallback"
                    size="card"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
