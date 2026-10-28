"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ImagePlus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClassName as input } from "@/components/ui/field";
import { setupStoreFromPromptAction } from "@/features/seller-ai/actions";
import { STORE_SETUP_MAX_PRODUCTS, type StoreSetupResult } from "@/features/seller-ai/schemas";
import {
  AiGenerationProgress,
  STORE_SETUP_STEPS,
  type AiGenerationProgressStatus,
} from "@/features/seller-ai/components/ai-generation-progress";

export type StoreSetupText = {
  title: string;
  description: string;
  promptLabel: string;
  placeholder: string;
  productName: string;
  addPhoto: string;
  removeProduct: string;
  addProduct: string;
  submit: string;
  working: string;
  done: string;
  review: string;
  cost: string;
  stepCategories: string;
  stepProducts: string;
  stepBlogs: string;
  stepReviews: string;
  progressLabel: string;
};

type Row = { key: number; name: string; file: File | null; preview: string | null };

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

/**
 * Build your store from a prompt: the seller describes the shop and lists a few products
 * (optionally with a photo each). The server writes categories, draft products, draft blogs
 * and pending sample reviews into this store.
 */
export function StoreSetupCard({ text }: { text: StoreSetupText }) {
  const nextKey = useRef(1);
  const [prompt, setPrompt] = useState("");
  const [rows, setRows] = useState<Row[]>([{ key: 0, name: "", file: null, preview: null }]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<StoreSetupResult | null>(null);
  const [genStatus, setGenStatus] = useState<AiGenerationProgressStatus>("idle");
  const [pending, start] = useTransition();

  const steps = [
    { ...STORE_SETUP_STEPS[0]!, label: text.stepCategories },
    { ...STORE_SETUP_STEPS[1]!, label: text.stepProducts },
    { ...STORE_SETUP_STEPS[2]!, label: text.stepBlogs },
    { ...STORE_SETUP_STEPS[3]!, label: text.stepReviews },
  ] as const;

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const setFile = (key: number, file: File | null) => {
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== key) return r;
        if (r.preview) URL.revokeObjectURL(r.preview);
        return { ...r, file, preview: file ? URL.createObjectURL(file) : null };
      }),
    );
  };
  const remove = (key: number) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs));
  const add = () => setRows((rs) => (rs.length >= STORE_SETUP_MAX_PRODUCTS ? rs : [...rs, { key: nextKey.current++, name: "", file: null, preview: null }]));

  const submit = () => {
    setError(null);
    setDone(null);
    setGenStatus("pending");
    const used = rows.filter((r) => r.name.trim());
    const fd = new FormData();
    fd.set("prompt", prompt);
    fd.set("products", JSON.stringify(used.map((r) => r.name.trim())));
    used.forEach((r, i) => {
      if (r.file) fd.set(`image_${i}`, r.file);
    });
    start(async () => {
      const r = await setupStoreFromPromptAction(fd);
      if (!r.ok) {
        setGenStatus("error");
        setError(r.error.fieldErrors?._form?.[0] ?? r.error.fieldErrors?.prompt?.[0] ?? r.error.message);
        return;
      }
      setGenStatus("success");
      setDone(r.data);
    });
  };

  return (
    <section data-tour="ai-setup" className="rounded-xl border border-border bg-surface shadow-xs" aria-label={text.progressLabel}>
      <header className="px-4 pt-4 sm:px-5">
        <h2 className="flex items-center gap-2 text-h3">
          <Sparkles aria-hidden className="size-4 text-accent" />
          {text.title}
        </h2>
        <p className="mt-0.5 text-caption text-muted">{text.description}</p>
      </header>
      <div className="space-y-3 p-4 sm:p-5">
        <label className="sr-only" htmlFor="ai-setup-prompt">
          {text.promptLabel}
        </label>
        <textarea
          id="ai-setup-prompt"
          className={`${input} min-h-20`}
          rows={3}
          maxLength={1000}
          placeholder={text.placeholder}
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            if (genStatus !== "idle") setGenStatus("idle");
            if (done) setDone(null);
          }}
        />
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.key} className="flex items-center gap-2">
              <label className="relative grid size-10 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-lg border border-border bg-surface-secondary text-muted hover:text-foreground" title={fill(text.addPhoto, { name: r.name || text.productName })}>
                {r.preview ? (
                  // Local object URL preview only; never uploaded until submit.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.preview} alt="" className="size-full object-cover" />
                ) : (
                  <ImagePlus aria-hidden className="size-4" />
                )}
                <span className="sr-only">{fill(text.addPhoto, { name: r.name || `${text.productName} ${i + 1}` })}</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => setFile(r.key, e.target.files?.[0] ?? null)} />
              </label>
              <input className={input} maxLength={120} placeholder={text.productName} aria-label={`${text.productName} ${i + 1}`} value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} />
              {rows.length > 1 ? (
                <button type="button" onClick={() => remove(r.key)} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-secondary hover:text-foreground" aria-label={text.removeProduct}>
                  <X aria-hidden className="size-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        <AiGenerationProgress steps={steps} status={genStatus} />
        {error ? (
          <p role="alert" className="rounded-md border border-error/25 bg-error/10 px-3 py-2 text-small text-error">
            {error}
          </p>
        ) : null}
        {done ? (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-success/25 bg-success/10 px-3 py-2 text-small text-success">
            <span>{fill(text.done, { categories: done.categories, products: done.products, blogs: done.blogs, reviews: done.reviews })}</span>
            <Link href="/dashboard/products?status=draft" className="font-semibold underline underline-offset-2">
              {text.review}
            </Link>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={add} disabled={rows.length >= STORE_SETUP_MAX_PRODUCTS}>
            {text.addProduct}
          </Button>
          <div className="flex items-center gap-3">
            <span className="hidden text-caption text-subtle sm:inline">{text.cost}</span>
            <Button type="button" pending={pending} disabled={prompt.trim().length < 10} onClick={submit}>
              <Sparkles aria-hidden />
              {pending ? text.working : text.submit}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
