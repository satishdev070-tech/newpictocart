"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { OnbHeading, OnbSub, onbButton } from "@/components/onboarding-ui";
import { publicEnv } from "@/lib/env/public";
import { storefrontPreviewUrl } from "@/lib/platform/urls";
import { startCopy } from "../copy";
import { LivePreview } from "../components/live-preview";

export function DoneScreen({
  locale,
  slug,
  rootDomain,
  storeName,
  onDashboard,
}: {
  locale: string;
  slug: string;
  rootDomain: string;
  storeName?: string | null;
  onDashboard: () => void;
}) {
  const c = startCopy(locale);
  const host = `${slug}.${rootDomain}`;
  const url = storefrontPreviewUrl(host, publicEnv().NEXT_PUBLIC_PLATFORM_URL);
  const [copied, setCopied] = useState(false);
  const name = storeName?.trim() || "";
  const subtitle = name.length >= 2 ? c.done.subNamed(name) : c.done.sub;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="relative grid w-full items-start gap-8 pt-4 sm:pt-8 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.6fr)] lg:gap-12">
      <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-6">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-mk-accent/40 bg-mk-accent-tint px-3 py-1 font-mk-mono text-[11px] uppercase tracking-[0.14em] text-mk-text">
          <span className="size-2 rounded-full bg-mk-accent" aria-hidden />
          {c.done.badge}
        </span>
        <OnbHeading as="h2" accent={c.done.titleAccent.trim()}>
          {c.done.title.trim()}
        </OnbHeading>
        <OnbSub className="max-w-md">{subtitle}</OnbSub>
        <div className="flex min-w-0 items-center gap-2 rounded-[var(--r-md)] border border-mk-line-strong bg-mk-elev-1 p-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 flex-1 truncate px-2 text-sm text-mk-text underline-offset-4 hover:underline"
          >
            {host}
          </a>
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-[var(--r-sm)] bg-mk-elev-2 px-3 text-sm font-medium text-mk-text transition-colors hover:bg-white/10"
          >
            {copied ? <Check aria-hidden className="size-4 text-mk-accent" /> : <Copy aria-hidden className="size-4" />}
            {copied ? c.done.copied : c.done.copy}
          </button>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button type="button" onClick={onDashboard} className={onbButton.primary}>
            {c.done.dashboard}
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noreferrer"
            className={onbButton.secondary}
          >
            {c.done.whatsapp}
          </a>
        </div>
      </aside>

      <div className="min-w-0 max-h-[640px] overflow-hidden lg:max-h-[720px]">
        <LivePreview locale={locale} rootDomain={rootDomain} liveSlug={slug} size="hero" />
      </div>
    </section>
  );
}
