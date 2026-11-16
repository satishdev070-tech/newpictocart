"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { OnbHeading, OnbSub, onbButton } from "@/components/onboarding-ui";
import { cn } from "@/lib/cn";
import { startCopy } from "../copy";
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
  const c = startCopy(draft.locale);
  // Ranked by the primary category (first of the multi-select).
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
      <div className="space-y-3 text-center">
        <OnbHeading as="h2" accent={c.theme.titleAccent}>
          {c.theme.title}
        </OnbHeading>
        <OnbSub>{options ? c.theme.subReady : c.theme.subLoading}</OnbSub>
      </div>

      {error ? (
        <p role="alert" className="rounded-[var(--r-md)] border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {/* md+: list left + large preview right; mobile: list stacked above preview */}
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-5 md:grid-cols-[minmax(240px,300px)_minmax(0,1fr)] md:items-start md:gap-6 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
        <div
          className="flex max-h-[280px] flex-col gap-2.5 overflow-y-auto overscroll-contain pr-1 md:max-h-[min(70vh,720px)]"
          role="listbox"
          aria-label={c.theme.listLabel}
        >
          {loading && themes.length === 0
            ? Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[76px] w-full shrink-0 animate-pulse rounded-[var(--r-md)] border border-mk-line bg-mk-elev-1"
                />
              ))
            : themes.map((t) => (
                <ThemeCard
                  key={t.key}
                  theme={t}
                  recommended={options?.recommended.key === t.key}
                  recommendedLabel={c.theme.recommended}
                  active={selectedKey === t.key}
                  onSelect={() => onPatch({ theme: t.key })}
                />
              ))}
        </div>

        <div className="overflow-hidden rounded-[var(--r-lg)] border border-mk-line bg-mk-elev-1 shadow-[var(--brand-shadow-card)]">
          <div className="flex items-center justify-between gap-3 border-b border-mk-line px-4 py-3.5 sm:px-6">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-mk-text sm:text-lg">
                {selectedMeta?.name ?? (loading ? c.theme.loading : c.theme.pick)}
              </p>
              {selectedKey && options?.recommended.key === selectedKey ? (
                <p className="font-mk-mono text-[11px] uppercase tracking-[0.14em] text-mk-accent">{c.theme.aiRecommended}</p>
              ) : selectedMeta?.industry ? (
                <p className="text-xs capitalize text-mk-muted sm:text-sm">
                  {selectedMeta.industry.replace(/-/g, " ")}
                </p>
              ) : null}
            </div>
            {selectedKey ? (
              <a
                href={themePreviewHref(selectedKey)}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(onbButton.secondary, "min-h-10 shrink-0 px-4 text-sm")}
              >
                {c.theme.preview} ↗
              </a>
            ) : null}
          </div>
          {/* Light island: the preview depicts the seller's (light) storefront. */}
          <div className="mk-light relative min-h-[320px] overflow-hidden bg-brand-canvas sm:min-h-[420px] lg:min-h-[560px]">
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
              <div className="grid min-h-[320px] place-items-center text-sm text-muted sm:min-h-[420px] lg:min-h-[560px]">
                {loading ? c.theme.subLoading : c.theme.selectToPreview}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onBack} className={onbButton.secondary}>
          ← {c.back}
        </button>
        <button type="button" disabled={!canContinue} onClick={onContinue} className={onbButton.primary}>
          {c.theme.continue}
        </button>
      </div>
    </section>
  );
}

function ThemeCard({
  theme,
  recommended,
  recommendedLabel,
  active,
  onSelect,
}: {
  theme: StartThemeOption;
  recommended: boolean;
  recommendedLabel: string;
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
        "relative flex w-full shrink-0 gap-3 overflow-hidden rounded-[var(--r-md)] border p-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent",
        active
          ? "border-mk-accent bg-mk-accent-tint shadow-[0_0_0_1px_var(--mk-accent)]"
          : "border-mk-line bg-mk-elev-1 hover:border-mk-line-strong hover:bg-mk-elev-2",
      )}
      aria-selected={active}
    >
      <div
        className="mk-light h-[56px] w-[84px] shrink-0 overflow-hidden rounded-[var(--r-sm)] border border-mk-line bg-brand-canvas"
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
          <div className="grid size-full place-items-center text-[10px] text-muted">—</div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 pr-5">
        <span className="line-clamp-2 text-sm font-semibold leading-snug text-mk-text">{theme.name}</span>
        {recommended ? (
          <span className="w-fit rounded-full bg-mk-accent-tint px-2 py-0.5 font-mk-mono text-[10px] uppercase tracking-[0.12em] text-mk-accent">
            {recommendedLabel}
          </span>
        ) : theme.industry ? (
          <span className="text-[11px] capitalize text-mk-muted">{theme.industry.replace(/-/g, " ")}</span>
        ) : null}
      </div>
      {active ? (
        <span className="absolute bottom-2.5 right-2.5 grid size-5 place-items-center rounded-full bg-mk-accent text-mk-accent-ink" aria-hidden>
          <Check className="size-3" strokeWidth={3} />
        </span>
      ) : null}
    </button>
  );
}
