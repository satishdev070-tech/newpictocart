"use client";

import { formatMoney } from "@/lib/money";
import { publicEnv } from "@/lib/env/public";
import { storefrontPreviewUrl } from "@/lib/platform/urls";
import { industryShort, isIndustry } from "@/features/stores/industries";
import { suggestSlugFromName } from "@/features/onboarding/voice/facts";
import { startCopy } from "../copy";
import { draftCategory, draftStoreName, type StartDraft } from "../draft/schema";
import { moodById } from "../moods";

/** Same slug the store is created with, shown in the preview address bar. */
export function startPreviewHost(name: string, rootDomain: string): string | null {
  const slug = suggestSlugFromName(name);
  if (!slug || slug.length < 3) return null;
  return `${slug}.${rootDomain}`;
}

export function LivePreview({
  locale,
  rootDomain,
  draft,
  liveSlug,
  productPhotos,
}: {
  locale: string;
  rootDomain: string;
  draft?: StartDraft | null;
  liveSlug?: string | null;
  /** Product id → curated photo URL. Local preview only; not part of the draft. */
  productPhotos?: Record<string, string>;
}) {
  const c = startCopy(locale);
  const slug = liveSlug ?? draft?.result?.slug ?? null;
  const name = draft ? draftStoreName(draft) : "";
  const host = slug ? `${slug}.${rootDomain}` : startPreviewHost(name, rootDomain);
  const mood = moodById(draft?.mood ?? null);
  const accent = draft?.accent || mood?.accentA || "#F97316";
  const bg = mood?.bg || "#FFF4E8";
  const tagline = draft?.business.tagline.trim() || draft?.voice.facts.tagline?.trim() || "";
  const category = draft ? draftCategory(draft) : null;
  const categoryLabel = category && isIndustry(category) ? industryShort(category) : null;
  const products = draft?.products ?? [];
  const placeholders = categoryLabel ? [categoryLabel, "New arrival", "Bestseller"] : ["Featured", "New arrival", "Bestseller"];

  return (
    <div className="flex h-full min-h-[320px] flex-col gap-2 lg:min-h-[480px]">
      <div className="flex items-center justify-between gap-2 text-sm text-[#5E5568]">
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-[#22C55E]" aria-hidden />
          {c.livePreview}
        </span>
        {draft && products.length ? <span className="text-[#6B6275]">{c.products.count(products.length)}</span> : null}
      </div>
      <div className="relative flex flex-1 flex-col overflow-hidden rounded-[20px] border border-[#2A2233]/10 bg-white shadow-inner">
        {host ? (
          <div className="border-b border-[#2A2233]/8 bg-white/70 px-4 py-2 text-center text-xs font-medium text-[#6B6275]">{host}</div>
        ) : null}
        {slug ? (
          <iframe
            title={c.livePreview}
            src={storefrontPreviewUrl(`${slug}.${rootDomain}`, publicEnv().NEXT_PUBLIC_PLATFORM_URL)}
            className="min-h-[280px] w-full flex-1 bg-white lg:min-h-[420px]"
          />
        ) : draft ? (
          <div className="flex flex-1 flex-col" style={{ background: bg }}>
            <div className="px-4 py-3" style={{ background: accent }}>
              <p className="font-brand text-lg text-white">{name || "Your store"}</p>
              {tagline ? <p className="mt-1 text-xs text-white/90">{tagline}</p> : null}
            </div>
            <div className="grid flex-1 grid-cols-2 gap-2 p-3">
              {(products.length ? products.slice(0, 4) : placeholders.slice(0, 3)).map((item, index) => {
                const title = typeof item === "string" ? item : item.title;
                const price = typeof item === "string" ? null : formatMoney(item.pricePaise);
                const photo = typeof item === "string" ? undefined : productPhotos?.[item.id];
                return (
                  <div key={`${title}-${index}`} className="rounded-xl bg-white/80 p-3 shadow-sm">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element -- local onboarding preview, not a stored product image
                      <img src={photo} alt="" className="mb-2 h-14 w-full rounded-lg object-cover" />
                    ) : (
                      <div className="mb-2 h-14 rounded-lg" style={{ background: `linear-gradient(135deg, ${accent}, ${mood?.accentB ?? "#FDBA74"})` }} />
                    )}
                    <p className="text-xs font-medium text-[#2A2233]">{title}</p>
                    {price ? <p className="mt-1 text-xs text-[#6B6275]">{price}</p> : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-[#6B6275]">
            <span className="max-w-[200px]">Your storefront will appear here as you build.</span>
          </div>
        )}
      </div>
    </div>
  );
}
