"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { findTheme, themePreviewHref } from "@/features/marketing-site/themes";
import { ThemeMockup } from "@/features/theme/marketplace/mockup";
import { listStartThemeOptionsAction } from "../actions";
import { draftCategory, type StartDraft } from "../draft/schema";
import {
  flattenStartThemeOptions,
  type StartThemeOption,
  type StartThemeOptions,
} from "../theme-options";

export function ThemeScreen({
  draft,
  onPatch,
  onBack,
  onContinue,
}: {
  draft: StartDraft;
  onPatch: (patch: Partial<StartDraft>) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const industry = draftCategory(draft) ?? "general";
  const [bundle, setBundle] = useState<{
    industry: string;
    options: StartThemeOptions | null;
    error: string | null;
  }>({ industry: "", options: null, error: null });
  const autoSelected = useRef(false);
  const onPatchRef = useRef(onPatch);

  useEffect(() => {
    onPatchRef.current = onPatch;
  }, [onPatch]);

  const loading = bundle.industry !== industry;
  const options = loading ? null : bundle.options;
  const error = loading ? null : bundle.error;

  useEffect(() => {
    let cancelled = false;
    const preferredTheme = draft.theme;
    void (async () => {
      const res = await listStartThemeOptionsAction({ industry, preferredTheme });
      if (cancelled) return;
      if (!res.ok) {
        setBundle({ industry, options: null, error: res.error.message });
        return;
      }
      setBundle({ industry, options: res.data, error: null });
      if (!preferredTheme && !autoSelected.current) {
        autoSelected.current = true;
        onPatchRef.current({ theme: res.data.recommended.key });
      }
    })();
    return () => {
      cancelled = true;
    };
    // preferredTheme is snapshotted for this industry fetch only — avoid re-fetch when auto-select patches theme.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [industry]);

  const themes = options ? flattenStartThemeOptions(options) : [];
  const selectedKey = draft.theme ?? options?.recommended.key ?? null;
  const selectedMeta = themes.find((t) => t.key === selectedKey) ?? options?.recommended ?? null;
  const selectedFull = selectedKey ? findTheme(selectedKey) : undefined;
  const canContinue = Boolean(selectedKey);

  return (
    <section className="flex w-full flex-col gap-6 sm:gap-7">
      <div className="text-center">
        <h2 className="font-brand text-3xl font-normal leading-tight text-balance sm:text-5xl">
          Let&apos;s design your{" "}
          <span className="italic text-[#C2410C]">storefront</span>
        </h2>
        <p className="mt-2.5 text-[15.5px] text-[#5E5568]">
          {options
            ? "Tara picked a look for your category — tap another if you prefer."
            : "Finding themes that fit your store…"}
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {/* md+: list left + large preview right; mobile: list stacked above preview */}
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-5 md:grid-cols-[minmax(240px,300px)_minmax(0,1fr)] md:items-start md:gap-6 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
        <div
          className="flex max-h-[280px] flex-col gap-2.5 overflow-y-auto overscroll-contain pr-1 md:max-h-[min(70vh,720px)]"
          role="listbox"
          aria-label="Theme options"
        >
          {loading && themes.length === 0
            ? Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[76px] w-full shrink-0 animate-pulse rounded-2xl border border-white/90 bg-white/50"
                />
              ))
            : themes.map((t) => (
                <ThemeCard
                  key={t.key}
                  theme={t}
                  recommended={options?.recommended.key === t.key}
                  active={selectedKey === t.key}
                  onSelect={() => onPatch({ theme: t.key })}
                />
              ))}
        </div>

        <div className="overflow-hidden rounded-[28px] border border-white/90 bg-white/70 shadow-[0_24px_60px_-28px_rgba(249,115,22,0.4)]">
          <div className="flex items-center justify-between gap-3 border-b border-[#2A2233]/8 px-4 py-3.5 sm:px-6">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-[#2A2233] sm:text-lg">
                {selectedMeta?.name ?? (loading ? "Loading…" : "Pick a theme")}
              </p>
              {selectedKey && options?.recommended.key === selectedKey ? (
                <p className="text-xs font-medium text-[#C2410C] sm:text-sm">AI recommended</p>
              ) : selectedMeta?.industry ? (
                <p className="text-xs capitalize text-[#6B6275] sm:text-sm">
                  {selectedMeta.industry.replace(/-/g, " ")}
                </p>
              ) : null}
            </div>
            {selectedKey ? (
              <a
                href={themePreviewHref(selectedKey)}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-full bg-[#FFF7ED] px-3 py-1.5 text-xs font-semibold text-[#C2410C] underline-offset-2 transition hover:bg-[#FFEDD5] hover:underline sm:text-sm"
              >
                Click to Preview
              </a>
            ) : (
              <span className="shrink-0 rounded-full bg-[#FFF7ED]/60 px-3 py-1.5 text-xs font-semibold text-[#C2410C]/50 sm:text-sm">
                Click to Preview
              </span>
            )}
          </div>
          <div className="relative min-h-[320px] overflow-hidden bg-[#FFF7ED]/50 sm:min-h-[420px] lg:min-h-[560px]">
            {selectedFull ? (
              <div className="max-h-[480px] overflow-hidden sm:max-h-[560px] lg:max-h-[720px]">
                <ThemeMockup
                  preset={selectedFull.preset}
                  name={selectedFull.name.split(" ")[0]!}
                  tagline={selectedFull.tagline}
                  themeKey={selectedFull.key}
                  size="large"
                />
              </div>
            ) : selectedMeta?.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element -- static theme preview webp
              <img
                src={selectedMeta.thumbnail}
                alt=""
                className="max-h-[480px] w-full object-cover object-top sm:max-h-[560px] lg:max-h-[720px]"
              />
            ) : (
              <div className="grid min-h-[320px] place-items-center text-sm text-[#6B6275] sm:min-h-[420px] lg:min-h-[560px]">
                {loading ? "Loading themes…" : "Select a theme to preview"}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-white/90 bg-white/60 px-5 py-3 text-sm font-medium text-[#5E5568]"
        >
          ← Back
        </button>
        <button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          className="rounded-full bg-linear-to-br from-[#FB923C] to-[#F97316] px-7 py-3.5 font-semibold text-white shadow-[0_16px_36px_-12px_rgba(249,115,22,0.65)] disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </section>
  );
}

function ThemeCard({
  theme,
  recommended,
  active,
  onSelect,
}: {
  theme: StartThemeOption;
  recommended: boolean;
  active: boolean;
  onSelect: () => void;
}) {
  const full = findTheme(theme.key);
  return (
    <button
      type="button"
      role="option"
      onClick={onSelect}
      className={cn(
        "relative flex w-full shrink-0 gap-3 overflow-hidden rounded-2xl border p-2.5 text-left transition",
        active
          ? "border-[#F97316] bg-white shadow-[0_16px_36px_-20px_rgba(249,115,22,0.55)] ring-2 ring-[#F97316]/30"
          : "border-white/90 bg-white/55 hover:bg-white/80",
      )}
      aria-selected={active}
    >
      <div
        className="h-[56px] w-[84px] shrink-0 overflow-hidden rounded-xl border border-[#2A2233]/8 bg-[#FFF7ED]/50"
        aria-hidden
      >
        {full ? (
          <div className="origin-top-left scale-[0.42]" style={{ width: "238%", height: "238%" }}>
            <ThemeMockup
              preset={full.preset}
              name={full.name.split(" ")[0]!}
              tagline={full.tagline}
              themeKey={full.key}
              size="card"
            />
          </div>
        ) : theme.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- static theme preview webp
          <img src={theme.thumbnail} alt="" className="size-full object-cover object-top" />
        ) : (
          <div className="grid size-full place-items-center text-[10px] text-[#6B6275]">Preview</div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 pr-5">
        <span className="line-clamp-2 text-sm font-semibold leading-snug text-[#2A2233]">{theme.name}</span>
        {recommended ? (
          <span className="w-fit rounded-full bg-[#FFF7ED] px-2 py-0.5 text-[11px] font-semibold text-[#C2410C]">
            Recommended
          </span>
        ) : theme.industry ? (
          <span className="text-[11px] capitalize text-[#6B6275]">{theme.industry.replace(/-/g, " ")}</span>
        ) : null}
      </div>
      {active ? (
        <span className="absolute bottom-2.5 right-2.5 grid size-5 place-items-center rounded-full bg-[#F97316] text-[10px] text-white">
          ✓
        </span>
      ) : null}
    </button>
  );
}
