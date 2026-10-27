"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { inputClassName as input } from "@/components/ui/field";
import { generateProductFromImageAction } from "@/features/catalog/actions";
import type { GeneratedProduct } from "@/features/catalog/ai-schemas";
import { toDecimalString } from "@/lib/money";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const MAX_BYTES = 4 * 1024 * 1024;

async function fileToBase64(file: File): Promise<{ mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string }> {
  const mime = (file.type || "image/jpeg").toLowerCase().replace("image/jpg", "image/jpeg");
  if (!/^image\/(jpeg|png|webp|gif)$/.test(mime)) throw new Error("Use a JPG, PNG, WebP or GIF image.");
  if (file.size > MAX_BYTES) throw new Error("Keep the image under 4 MB.");
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return { mimeType: mime as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: btoa(binary) };
}

export type ProductMediaOption = { url: string; label: string };

/**
 * Generate with AI panel. Fills the parent draft via onApply; does not save the product.
 * New products: upload a file. Saved products: pick a store-assets URL (assetUrl) and/or upload.
 */
export function GenerateProductWithAi({
  media,
  hints,
  onApply,
}: {
  media: ProductMediaOption[];
  hints: { title: string; brand: string };
  onApply: (product: GeneratedProduct, extras: { priceRupees: string | null }) => void;
}) {
  const [selectedUrls, setSelectedUrls] = useState<string[]>(() => (media[0]?.url ? [media[0].url] : []));
  const [extraUrl, setExtraUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleUrl = (url: string) => {
    setSelectedUrls((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : prev.length >= 4 ? prev : [...prev, url]));
  };

  const run = (files: FileList | null) => {
    setMessage(null);
    start(async () => {
      try {
        const images: { mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string }[] = [];
        if (files?.length) {
          for (const f of Array.from(files).slice(0, 2)) {
            images.push(await fileToBase64(f));
          }
        }
        const imageUrls = [...selectedUrls];
        const trimmed = extraUrl.trim();
        if (trimmed && !imageUrls.includes(trimmed)) imageUrls.push(trimmed);
        if (!imageUrls.length && !images.length) {
          setMessage({
            tone: "error",
            text: media.length
              ? "Select a product image, paste a public image URL, or upload a file."
              : "Upload a product photo, or save the product with images first and open Generate with AI again.",
          });
          return;
        }
        const r = await generateProductFromImageAction({
          imageUrls: imageUrls.slice(0, 4),
          images,
          hints: {
            title: hints.title || undefined,
            brand: hints.brand || undefined,
            notes: notes.trim() || undefined,
          },
        });
        if (!r.ok) {
          setMessage({ tone: "error", text: Object.values(r.error.fieldErrors ?? {})[0]?.[0] ?? r.error.message });
          return;
        }
        const priceRupees = r.data.priceHintPaise != null ? toDecimalString(r.data.priceHintPaise) : null;
        onApply(r.data, { priceRupees });
        setMessage({ tone: "success", text: "Draft filled from the image. Review fields, then save when ready." });
        if (fileRef.current) fileRef.current.value = "";
      } catch (err) {
        setMessage({ tone: "error", text: err instanceof Error ? err.message : "Could not read that image." });
      }
    });
  };

  return (
    <div className="space-y-3 rounded-md border border-border bg-surface/60 p-3">
      <div>
        <p className="text-sm font-medium">Generate with AI</p>
        <p className="mt-0.5 text-xs text-muted">Uses 2 AI credits. Fills the form only — nothing is saved until you click Save.</p>
      </div>
      {media.length ? (
        <fieldset>
          <legend className="mb-1 text-xs font-medium text-muted">Product images</legend>
          <ul className="flex flex-wrap gap-2">
            {media.map((m) => {
              const on = selectedUrls.includes(m.url);
              return (
                <li key={m.url}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleUrl(m.url)}
                    className={`overflow-hidden rounded border ${on ? "border-accent ring-1 ring-accent" : "border-border"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- small picker thumbnails */}
                    <img src={m.url} alt={m.label} className="size-14 object-cover" />
                  </button>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ) : (
        <p className="text-xs text-muted">New product: upload a photo below, or save with images via the media manager first.</p>
      )}
      <div>
        <label htmlFor="ai-img-url" className="mb-1 block text-xs font-medium text-muted">
          Or public image URL
        </label>
        <input id="ai-img-url" className={input} value={extraUrl} placeholder="https://…" onChange={(e) => setExtraUrl(e.target.value)} />
      </div>
      <div>
        <label htmlFor="ai-notes" className="mb-1 block text-xs font-medium text-muted">
          Optional hints
        </label>
        <input id="ai-notes" className={input} value={notes} maxLength={500} placeholder="e.g. cotton summer kurta, festive set" onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" pending={pending} disabled={pending} onClick={() => run(null)}>
          Generate from selected
        </Button>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-accent underline">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            disabled={pending}
            onChange={(e) => run(e.target.files)}
          />
          Upload & generate
        </label>
      </div>
      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={`text-small ${message.tone === "error" ? "text-error" : "text-success"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
