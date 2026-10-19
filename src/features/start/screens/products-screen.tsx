"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { toMinor } from "@/lib/money";
import { startSuggestAction } from "../actions";
import { startCopy } from "../copy";
import type { StartDraft, StartDraftProduct } from "../draft/schema";
import { LivePreview } from "../components/live-preview";
import { progressFor } from "../flow";

const SAMPLES = [
  { id: "s1", title: "Bandhani silk stole", grad: "from-rose-300 to-orange-300" },
  { id: "s2", title: "Kota cotton saree", grad: "from-sky-200 to-indigo-300" },
  { id: "s3", title: "Brass diya set", grad: "from-amber-200 to-yellow-500" },
  { id: "s4", title: "Spice gift box", grad: "from-red-300 to-amber-600" },
] as const;

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
  const host = draft.business.name.trim() ? `${draft.business.name.toLowerCase().replace(/\s+/g, "")}.${rootDomain}` : null;

  function addProduct() {
    if (draft.products.length >= 12) return;
    const t = title.trim() || SAMPLES.find((s) => s.id === sample)?.title || "";
    if (!t) return;
    let paise = 0;
    try {
      paise = price.trim() ? toMinor(price.replace(/[,₹\s]/g, "")) : toMinor(999);
    } catch {
      return;
    }
    onChange([...draft.products, { id: crypto.randomUUID(), title: t, pricePaise: paise }]);
    setTitle("");
    setPrice("");
    setSample(null);
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
          {draft.products.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-2xl bg-white/80 px-3 py-2">
              <span className="text-sm font-medium">{p.title}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#C2410C]">₹{Math.round(p.pricePaise / 100)}</span>
                <button type="button" onClick={() => onChange(draft.products.filter((x) => x.id !== p.id))} className="text-xs text-[#6B6275]">
                  {c.products.remove}
                </button>
              </div>
            </li>
          ))}
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
                className={cn("size-14 rounded-xl bg-linear-to-br", s.grad, sample === s.id && "ring-2 ring-[#F97316]")}
                aria-label={s.title}
              />
            ))}
          </div>
          <button type="button" onClick={() => void aiTitle()} className="text-xs font-semibold text-[#7C5AA6]">
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
        <LivePreview locale={draft.locale} host={host} productCount={draft.products.length} />
      </div>
    </>
  );
}
