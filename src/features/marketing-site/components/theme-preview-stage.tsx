"use client";

import { useState, type ReactNode } from "react";
import { ExternalLink, Monitor, Smartphone } from "lucide-react";
import { buttonClass } from "./ui";

/**
 * Device switcher + stage of the on-site theme preview. With `liveUrl` the real demo store is
 * framed (interactive, at the frame's true width); otherwise `sample` (the server-rendered sample
 * store) is shown in a scrollable frame. The phone frame is 390 px wide, so both show their
 * real mobile layout.
 */
export function ThemePreviewStage({ liveUrl, sample, title }: { liveUrl: string | null; sample: ReactNode; title: string }) {
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [loaded, setLoaded] = useState(false);
  const phone = device === "phone";
  const tab = (d: "desktop" | "phone", label: string, Icon: typeof Monitor) => (
    <button
      type="button"
      role="tab"
      aria-selected={device === d}
      onClick={() => setDevice(d)}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand ${device === d ? "bg-white text-brand-ink shadow-sm" : "text-muted hover:text-brand-ink"}`}
    >
      <Icon aria-hidden className="size-4" /> {label}
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Device" className="inline-flex rounded-full bg-brand-canvas p-1 ring-1 ring-border">
          {tab("desktop", "Desktop", Monitor)}
          {tab("phone", "Phone", Smartphone)}
        </div>
        <p className="text-sm text-muted">{liveUrl ? "Live demo store with this theme applied. Nothing is saved." : "Sample store drawn from this theme's colours, fonts and layout."}</p>
        {liveUrl ? (
          <a href={liveUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
            Open in new tab <ExternalLink aria-hidden className="size-3.5" />
          </a>
        ) : null}
      </div>

      <div className={`mt-4 flex justify-center rounded-brand-lg bg-brand-canvas ring-1 ring-border ${phone ? "py-6" : "p-2 sm:p-3"}`}>
        <div
          className={`relative overflow-hidden bg-white shadow-brand-card ${phone ? "h-[min(78dvh,844px)] w-[390px] max-w-full rounded-[28px] border-[8px] border-brand-ink" : "h-[min(78dvh,860px)] w-full rounded-brand-md border border-border"}`}
        >
          {liveUrl ? (
            <>
              {!loaded ? <div className="absolute inset-0 overflow-y-auto">{sample}</div> : null}
              <iframe src={liveUrl} title={title} onLoad={() => setLoaded(true)} className={`absolute inset-0 size-full border-0 bg-white transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`} />
            </>
          ) : (
            <div className="absolute inset-0 overflow-y-auto overscroll-contain" tabIndex={0} aria-label={title}>
              {sample}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
