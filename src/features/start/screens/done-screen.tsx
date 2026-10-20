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
  onDashboard,
}: {
  locale: string;
  slug: string;
  rootDomain: string;
  onDashboard: () => void;
}) {
  const c = startCopy(locale);
  const host = `${slug}.${rootDomain}`;
  const url = storefrontPreviewUrl(host, publicEnv().NEXT_PUBLIC_PLATFORM_URL);
  const [copied, setCopied] = useState(false);

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
    <section className="relative grid gap-10 lg:grid-cols-2">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className="absolute size-2 rounded-sm opacity-60"
            style={{
              left: `${(i * 17) % 100}%`,
              top: `${(i * 23) % 100}%`,
              background: ["#F97316", "#C084FC", "#22C55E", "#3B82F6"][i % 4],
              transform: `rotate(${i * 15}deg)`,
            }}
          />
        ))}
      </div>
      <div className="relative z-10 flex flex-col gap-5">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#DCFCE7] px-3 py-1 text-sm font-medium text-[#166534]">
          <span className="size-2 rounded-full bg-[#22C55E]" />
          {c.done.badge}
        </span>
        <h2 className="font-brand text-4xl">
          {c.done.title}
          <span className="text-[#C2410C]">{c.done.titleAccent}</span>
        </h2>
        <p className="text-[#5E5568]">{c.done.sub}</p>
        <div className="flex items-center gap-2 rounded-2xl border bg-white/80 p-2">
          <a href={url} target="_blank" rel="noreferrer" className="flex-1 truncate px-2 text-sm underline-offset-2 hover:underline">
            {host}
          </a>
          <button type="button" onClick={() => void copy()} className="rounded-xl bg-[#2A2233] px-3 py-2 text-sm text-white">
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
          <button type="button" onClick={onDashboard} className="rounded-full bg-[#F97316] px-5 py-3 text-sm font-semibold text-white">
            {c.done.dashboard}
          </button>
        </div>
        <Link href="/start" onClick={() => clearStartDraftStorage()} className="text-sm text-[#7C5AA6] underline">
          {c.done.tryLook}
        </Link>
      </div>
      <div className="relative z-10 hidden lg:block">
        <LivePreview locale={locale} rootDomain={rootDomain} liveSlug={slug} />
      </div>
    </section>
  );
}
