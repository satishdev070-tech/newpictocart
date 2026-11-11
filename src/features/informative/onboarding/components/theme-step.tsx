"use client";

import { useEffect, useRef, useState } from "react";
import { Monitor, Smartphone, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { recommendedThemeIds } from "../../themes/registry";
import { trackInformativeEvent } from "../analytics";
import { INFO_PREVIEW_LOGO_KEY } from "../draft";
import { ui } from "./shell";

export type ThemeCard = { id: string; name: string; bestFor: string; tagline: string; swatches: string[] };

/**
 * Informative Step 2 — choose one of the 11 themes. Recommended badge on 1–2 themes for the chosen
 * category; all stay selectable. "Preview" opens a full-screen live preview (the real renderer in an
 * iframe, so mobile is a true 390 px viewport) with the user's name and logo.
 */
export function ThemeStep({
  themes,
  category,
  businessName,
  logoDataUrl,
  selected,
  onSelect,
  onContinue,
  onBack,
}: {
  themes: ThemeCard[];
  category: string | null;
  businessName: string;
  logoDataUrl: string | null;
  selected: string | null;
  onSelect: (id: string) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const recommended = new Set(recommendedThemeIds(category));
  const ordered = [...themes].sort((a, b) => Number(recommended.has(b.id)) - Number(recommended.has(a.id)));
  const [preview, setPreview] = useState<ThemeCard | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (preview) dialog.current?.showModal();
    else dialog.current?.close();
  }, [preview]);

  function openPreview(t: ThemeCard) {
    try {
      if (logoDataUrl) window.sessionStorage.setItem(INFO_PREVIEW_LOGO_KEY, logoDataUrl);
      else window.sessionStorage.removeItem(INFO_PREVIEW_LOGO_KEY);
    } catch {
      // The preview then shows the business name without the logo.
    }
    trackInformativeEvent({ name: "informative_theme_previewed", params: { themeId: t.id } });
    setPreview(t);
  }

  function choose(id: string) {
    setError(false);
    onSelect(id);
  }

  function next() {
    if (!selected) {
      setError(true);
      return;
    }
    trackInformativeEvent({ name: "informative_theme_selected", params: { themeId: selected } });
    onContinue();
  }

  const q = new URLSearchParams({ ...(businessName ? { name: businessName } : {}), ...(category ? { category } : {}), ...(logoDataUrl ? { logo: "session" } : {}) }).toString();

  return (
    <section className="flex flex-col gap-6" aria-labelledby="theme-title">
      <div>
        <h1 id="theme-title" className="font-brand text-3xl sm:text-4xl">Choose a design</h1>
        <p className="mt-2 text-[#5E5568]">Every design works on phones and computers. You can switch later without losing your content.</p>
      </div>
      <fieldset aria-describedby={error ? "theme-error" : undefined}>
        <legend className="sr-only">Website design</legend>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((t) => {
            const active = selected === t.id;
            return (
              <li key={t.id} className={cn("overflow-hidden rounded-3xl border bg-white shadow-sm", active ? "border-[#C2410C] ring-2 ring-[#C2410C]/30" : "border-[#2A2233]/15")}>
                <label className="block cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#C2410C]">
                  <input type="radio" name="theme" value={t.id} checked={active} onChange={() => choose(t.id)} className="sr-only" aria-labelledby={`theme-${t.id}`} aria-describedby={`theme-${t.id}-best${recommended.has(t.id) ? ` theme-${t.id}-rec` : ""}`} />
                  <span className="relative block">
                    {/* eslint-disable-next-line @next/next/no-img-element -- static thumbnail in /public */}
                    <img src={`/informative/themes/${t.id}.webp`} alt="" width={640} height={400} loading="lazy" decoding="async" className="aspect-[8/5] w-full object-cover" />
                    {recommended.has(t.id) ? <span id={`theme-${t.id}-rec`} className="absolute top-3 left-3 rounded-full bg-[#2A2233] px-3 py-1 text-xs font-semibold text-white">Recommended</span> : null}
                  </span>
                  <span className="flex items-start justify-between gap-3 p-4">
                    <span>
                      <span id={`theme-${t.id}`} className="block font-semibold">{t.name}</span>
                      <span id={`theme-${t.id}-best`} className="block text-sm text-[#5E5568]">{t.bestFor}</span>
                    </span>
                    <span className="flex shrink-0 gap-1" aria-hidden>
                      {t.swatches.map((c) => (
                        <span key={c} className="size-4 rounded-full border border-black/10" style={{ background: c }} />
                      ))}
                    </span>
                  </span>
                </label>
                <div className="flex items-center justify-between border-t border-[#2A2233]/10 px-4 py-2">
                  <button type="button" onClick={() => openPreview(t)} className={ui.ghostBtn} aria-label={`Preview ${t.name}`}>
                    Preview
                  </button>
                  {active ? <span className="text-sm font-semibold text-[#C2410C]">Selected</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </fieldset>
      {error ? (
        <p id="theme-error" className={ui.error} role="alert">
          Choose a design to continue.
        </p>
      ) : null}
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className={ui.ghostBtn}>← Back</button>
        <button type="button" onClick={next} className={ui.primaryBtn}>Continue</button>
      </div>

      <dialog
        ref={dialog}
        onClose={() => setPreview(null)}
        aria-label={preview ? `${preview.name} preview` : "Theme preview"}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-[#2A2233] p-0 backdrop:bg-black/60"
      >
        {preview ? (
          <div className="flex h-full flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#2A2233] px-4 py-2 text-white">
              <p className="font-semibold">{preview.name}</p>
              <div className="flex items-center gap-1" role="group" aria-label="Device">
                <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")} className={cn("flex min-h-11 items-center gap-2 rounded-full px-3 text-sm", device === "desktop" ? "bg-white text-[#2A2233]" : "text-white")}>
                  <Monitor aria-hidden className="size-4" /> Desktop
                </button>
                <button type="button" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")} className={cn("flex min-h-11 items-center gap-2 rounded-full px-3 text-sm", device === "mobile" ? "bg-white text-[#2A2233]" : "text-white")}>
                  <Smartphone aria-hidden className="size-4" /> Mobile
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    choose(preview.id);
                    setPreview(null);
                  }}
                  className="min-h-11 rounded-full bg-[#C2410C] px-4 text-sm font-semibold text-white"
                >
                  Use this design
                </button>
                <button type="button" onClick={() => setPreview(null)} className="grid min-h-11 min-w-11 place-items-center rounded-full text-white" aria-label="Close preview">
                  <X aria-hidden className="size-5" />
                </button>
              </div>
            </div>
            <div className="flex flex-1 justify-center overflow-hidden bg-[#3B3245]">
              <iframe
                key={`${preview.id}-${device}`}
                title={`${preview.name} preview with your business name`}
                src={`/informative/preview/${preview.id}${q ? `?${q}` : ""}`}
                className={cn("h-full border-0 bg-white", device === "mobile" ? "my-4 h-[calc(100%-2rem)] w-[390px] rounded-2xl" : "w-full")}
              />
            </div>
          </div>
        ) : null}
      </dialog>
    </section>
  );
}
