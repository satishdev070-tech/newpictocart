"use client";

import { useState } from "react";
import Link from "next/link";
import { publicEnv } from "@/lib/env/public";
import { storefrontPreviewUrl } from "@/lib/platform/urls";
import { startCopy } from "../copy";
import { clearStartDraftStorage } from "../draft/storage";
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
    <section className="relative flex w-full flex-col gap-10 lg:gap-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 overflow-hidden" aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className="absolute size-1.5 rounded-full opacity-40"
            style={{
              left: `${8 + ((i * 11) % 84)}%`,
              top: `${12 + ((i * 17) % 60)}%`,
              background: ["#F97316", "#FB923C", "#22C55E", "#FDBA74"][i % 4],
            }}
          />
        ))}
      </div>

      <div className="relative z-10 grid items-start gap-8 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.6fr)] lg:gap-12">
        <aside className="flex flex-col gap-5 lg:sticky lg:top-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#DCFCE7] px-3 py-1 text-sm font-medium text-[#166534]">
            <span className="size-2 rounded-full bg-[#22C55E]" />
            {c.done.badge}
          </span>
          <h2 className="font-brand text-4xl leading-tight sm:text-5xl">
            {c.done.title}
            <span className="text-[#C2410C]">{c.done.titleAccent}</span>
          </h2>
          <p className="max-w-md text-[#5E5568]">{subtitle}</p>
          <div className="flex items-center gap-2 rounded-2xl border border-white/90 bg-white/80 p-2 shadow-sm">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="flex-1 truncate px-2 text-sm underline-offset-2 hover:underline"
            >
              {host}
            </a>
            <button
              type="button"
              onClick={() => void copy()}
              className="rounded-xl bg-[#2A2233] px-3 py-2 text-sm text-white"
            >
              {copied ? c.done.copied : c.done.copy}
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(url)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-[#22C55E] px-5 py-3 text-sm font-semibold text-white"
            >
              {c.done.whatsapp}
            </a>
            <button
              type="button"
              onClick={onDashboard}
              className="rounded-full bg-[#F97316] px-5 py-3 text-sm font-semibold text-white"
            >
              {c.done.dashboard}
            </button>
          </div>
          <Link
            href="/start"
            onClick={() => clearStartDraftStorage()}
            className="text-sm text-[#C2410C] underline underline-offset-2"
          >
            {c.done.tryLook}
          </Link>
        </aside>

        <div className="relative z-10 min-w-0">
          <LivePreview locale={locale} rootDomain={rootDomain} liveSlug={slug} size="hero" />
        </div>
      </div>

      <div className="relative z-10 rounded-[24px] border border-white/90 bg-white/75 px-5 py-7 shadow-sm sm:px-8">
        <div className="mb-7 text-center sm:text-left">
          <p className="font-brand text-2xl text-[#2A2233] sm:text-3xl">{c.done.journeyTitle}</p>
          <p className="mt-1.5 max-w-2xl text-sm text-[#5E5568] sm:text-base">{c.done.journeySub}</p>
        </div>
        <ol className="grid grid-cols-1 gap-5 sm:grid-cols-5 sm:gap-3">
          {c.done.journeySteps.map((step, index) => (
            <li key={step.label} className="relative flex flex-col items-center gap-2 text-center sm:items-stretch sm:text-left">
              {index < c.done.journeySteps.length - 1 ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-[calc(50%+18px)] top-4 hidden h-0.5 w-[calc(100%-36px)] bg-linear-to-r from-[#22C55E] to-[#86EFAC] sm:block"
                />
              ) : null}
              <span className="relative z-10 mx-auto grid size-9 place-items-center rounded-full bg-[#22C55E] text-sm font-semibold text-white shadow-[0_8px_18px_-10px_rgba(34,197,94,0.8)] sm:mx-0">
                ✓
              </span>
              <span className="text-sm font-semibold text-[#2A2233]">{step.label}</span>
              <span className="text-xs leading-snug text-[#6B6275]">{step.blurb}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
