"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { inputClassName as input } from "@/components/ui/field";
import { generateProductFromImageAction } from "@/features/seller-ai/actions";
import type { GenerateProductResult } from "@/features/seller-ai/schemas";
import { formatMoney } from "@/lib/money";

/**
 * Generate with AI for the product editor. New products have no media until save, so this accepts
 * a local File upload and/or https image URLs from ProductMediaManager after save.
 */
export function ProductGenerateAi({
  imageUrls,
  onApply,
}: {
  imageUrls: string[];
  onApply: (result: GenerateProductResult) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [hint, setHint] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<GenerateProductResult | null>(null);
  const [pending, start] = useTransition();

  const run = () => {
    setError(null);
    const files = fileRef.current?.files ? Array.from(fileRef.current.files).slice(0, 4) : [];
    start(async () => {
      const r = await generateProductFromImageAction({ imageUrls, hint: hint.trim() || undefined, images: files });
      if (!r.ok) {
        setError(r.error.fieldErrors?._form?.[0] ?? r.error.message);
        setPreview(null);
        return;
      }
      setPreview(r.data);
      onApply(r.data);
    });
  };

  return (
    <div className="space-y-3 rounded-md border border-border bg-surface-secondary/40 p-3">
      <div>
        <p className="text-sm font-medium">Generate with AI</p>
        <p className="text-caption text-muted">
          Upload a photo{imageUrls.length ? " or use saved product images" : " (new products have no media until you save)"} and optionally a short hint. Uses AI credits.
        </p>
      </div>
      <div>
        <label htmlFor="ai-product-images" className="mb-1 block text-sm font-medium">
          Product photo
        </label>
        <input id="ai-product-images" ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="text-sm" />
        {imageUrls.length ? <p className="mt-1 text-caption text-muted">{imageUrls.length} saved image{imageUrls.length === 1 ? "" : "s"} will also be sent.</p> : null}
      </div>
      <div>
        <label htmlFor="ai-product-hint" className="mb-1 block text-sm font-medium">
          Hint <span className="font-normal text-muted">(optional)</span>
        </label>
        <input id="ai-product-hint" className={input} value={hint} maxLength={500} placeholder="e.g. cotton kurta for festive wear, mid-range" onChange={(e) => setHint(e.target.value)} />
      </div>
      <Button type="button" variant="secondary" pending={pending} onClick={run} className="w-full">
        {pending ? "Generating…" : "Generate with AI"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}
      {preview ? (
        <p role="status" className="text-caption text-success">
          Draft applied · suggested {formatMoney(preview.priceMinor)}. Review before saving.
        </p>
      ) : null}
    </div>
  );
}
