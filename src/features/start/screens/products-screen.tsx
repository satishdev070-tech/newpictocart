"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { toMinor } from "@/lib/money";
import { curatedStockSet, pickStock, sizedStockUrl } from "@/lib/unsplash-stock";
import { startSuggestAction } from "../actions";
import { startCopy } from "../copy";
import type { StartDraft, StartDraftProduct } from "../draft/schema";
import { LivePreview } from "../components/live-preview";
import { progressFor } from "../flow";

const PHOTO_WIDTH = 480;

const PRODUCT_PHOTO_SAMPLES = [
  { id: "food", category: "food", title: "Spice gift box" },
  { id: "fashion", category: "fashion", title: "Bandhani silk stole" },
  { id: "furniture", category: "furniture", title: "Teak armchair" },
  { id: "handicrafts", category: "handicrafts", title: "Brass diya set" },
] as const;

const SAMPLES = PRODUCT_PHOTO_SAMPLES.map((sample) => {
  const photo = pickStock(curatedStockSet(sample.category), "products", 0);
  return {
    id: sample.id,
    title: sample.title,
    url: photo ? sizedStockUrl(photo.url, PHOTO_WIDTH) : "",
  };
});

export function ProductsScreen({
  draft,
  rootDomain,
  onChange,
  onNext,
}: {
  draft: StartDraft;
  rootDomain: string;
  onChange: (products: StartDraftProduct[]) => void;
  onNext: () => void;
}) {
  const c = startCopy(draft.locale);
  const manual = progressFor("products", draft.path, draft.locale).manual;
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [sample, setSample] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const chosen = SAMPLES.find((s) => s.id === sample) ?? null;
  function addProduct() {
    if (draft.products.length >= 12) return;
    const t = title.trim() || chosen?.title || "";
    if (!t) return;
    let paise = 0;
    try {
      paise = price.trim() ? toMinor(price.replace(/[,₹\s]/g, "")) : toMinor(999);
    } catch {
      return;
    }
    const id = crypto.randomUUID();
    onChange([...draft.products, { id, title: t, pricePaise: paise }]);
    if (chosen?.url) setPhotos((current) => ({ ...current, [id]: chosen.url }));
    setTitle("");
    setPrice("");
    setSample(null);
  }

  function removeProduct(id: string) {
    onChange(draft.products.filter((x) => x.id !== id));
    setPhotos((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  async function aiTitle() {
    const hint = SAMPLES.find((s) => s.id === sample)?.title ?? title;
    const fd = new FormData();
    fd.set("locale", draft.locale);
    fd.set("kind", "productTitle");
    fd.set("hint", hint);
    const res = await startSuggestAction(null, fd);
    if (res?.ok) setTitle(res.data.text);
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {manual ? <p className="text-xs text-[#6B6275]">{manual}</p> : null}
        <h2 className="font-brand text-3xl">
          {c.products.title}
          <span className="text-[#C2410C]">{c.products.titleAccent}</span>
        </h2>
        <ul className="space-y-2">
          {draft.products.map((p) => {
            const photo = photos[p.id];
            return (
              <li key={p.id} className="flex items-center justify-between rounded-2xl bg-white/80 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local onboarding preview, not a stored product image
                    <img src={photo} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
                  ) : null}
                  <span className="truncate text-sm font-medium">{p.title}</span>
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[#C2410C]">₹{Math.round(p.pricePaise / 100)}</span>
                  <button type="button" onClick={() => removeProduct(p.id)} className="text-xs text-[#6B6275]">
                    {c.products.remove}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="rounded-[24px] border bg-white/70 p-4 space-y-3">
          <p className="font-semibold">{c.products.newProduct}</p>
          <p className="text-sm text-[#6B6275]">{c.products.photo}</p>
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSample(s.id);
                  setTitle(s.title);
                }}
                className={cn("size-14 overflow-hidden rounded-xl", sample === s.id && "ring-2 ring-[#F97316] ring-offset-2")}
                aria-label={s.title}
                aria-pressed={sample === s.id}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- curated Unsplash sample, not a stored product image */}
                <img src={s.url} alt="" className="size-full rounded-xl object-cover" />
              </button>
            ))}
          </div>
          {chosen?.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- chosen sample preview, not a stored product image
            <img src={chosen.url} alt={chosen.title} className="h-16 w-16 rounded-xl object-cover" />
          ) : null}
          <button type="button" onClick={() => void aiTitle()} className="text-xs font-semibold text-[#C2410C]">
            {c.products.photoAi}
          </button>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={c.products.titlePh} className="w-full rounded-xl border px-3 py-2" />
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="1280" className="w-full rounded-xl border px-3 py-2" />
          <button type="button" onClick={addProduct} className="rounded-full bg-[#2A2233]/10 px-4 py-2 text-sm">
            {c.products.add}
          </button>
        </div>
        <button type="button" onClick={onNext} className="rounded-full bg-[#F97316] px-7 py-3 font-semibold text-white">
          {c.products.next}
        </button>
      </div>
      <div className="hidden lg:block">
        <LivePreview locale={draft.locale} rootDomain={rootDomain} draft={draft} productPhotos={photos} />
      </div>
    </>
  );
}
