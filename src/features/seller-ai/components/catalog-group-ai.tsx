"use client";

import { useId, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint, Label, inputClassName as input } from "@/components/ui/field";
import { Badge } from "@/components/ui/layout";
import { generateCatalogGroupFromImageAction } from "@/features/seller-ai/actions";
import { AiPhotoPicker, useAiPhotos } from "@/features/seller-ai/components/ai-photo-picker";
import { classifyAiError } from "@/features/seller-ai/components/product-generate-ai";
import type { CatalogGroupTarget, GenerateCatalogGroupResult } from "@/features/seller-ai/schemas";

const NOUN: Record<CatalogGroupTarget, string> = { category: "category", collection: "collection" };

/**
 * "Create with AI from photo" for Categories and Collections. Click a picture or upload one,
 * optionally add a hint, review the draft, then Apply fills the form (name, handle, description,
 * SEO) and hands the first photo to the image field. Nothing is saved until the form is saved.
 */
export function CatalogGroupAi({ target, onApply, credits = 2 }: { target: CatalogGroupTarget; onApply: (draft: GenerateCatalogGroupResult, photo: File | null) => void; credits?: number }) {
  const hintId = useId();
  const photos = useAiPhotos(2);
  const [hint, setHint] = useState("");
  const [error, setError] = useState<ReturnType<typeof classifyAiError> | null>(null);
  const [draft, setDraft] = useState<GenerateCatalogGroupResult | null>(null);
  const [pending, start] = useTransition();
  const canGenerate = photos.images.length > 0 || hint.trim().length >= 3;
  const noun = NOUN[target];

  const run = () => {
    if (!canGenerate || pending) return;
    setError(null);
    setDraft(null);
    start(async () => {
      const r = await generateCatalogGroupFromImageAction({ target, hint: hint.trim() || undefined, images: photos.images.map((i) => i.file) });
      if (!r.ok) {
        setError(classifyAiError(r.error.fieldErrors?._form?.[0] ?? r.error.message));
        return;
      }
      setDraft(r.data);
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-accent/25 bg-accent-soft/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-label font-semibold">
            <Sparkles aria-hidden className="size-4 text-accent" />
            Create with AI from photo
          </p>
          <p className="mt-0.5 text-small text-muted">Click a picture of the products for this {noun}. AI writes the name, description and search listing.</p>
        </div>
        <Badge tone="neutral">~{credits} credits</Badge>
      </div>
      <AiPhotoPicker photos={photos} label="Photo" />
      <div>
        <Label htmlFor={hintId} optional>
          Hint
        </Label>
        <input id={hintId} className={input} value={hint} maxLength={500} placeholder={target === "category" ? "e.g. cotton kurtas for women" : "e.g. Diwali gifting under ₹999"} onChange={(e) => setHint(e.target.value)} />
        {!canGenerate ? <Hint>Add a photo or a hint of at least 3 characters.</Hint> : null}
      </div>
      {error ? (
        <div role="alert" className="rounded-md border border-error/25 bg-error/10 px-3 py-2 text-small text-error">
          <p className="font-medium">{error.kind === "setup" ? "AI isn't set up" : "Generation failed"}</p>
          <p className="mt-0.5">{error.text}</p>
        </div>
      ) : null}
      <Button type="button" variant="secondary" pending={pending} disabled={!canGenerate} onClick={run} className="min-h-11 w-full sm:min-h-9 sm:w-auto">
        <Sparkles aria-hidden className="size-4" />
        {pending ? "Writing…" : `Create ${noun} with AI`}
      </Button>
      {draft ? (
        <div className="space-y-3 rounded-lg border border-border bg-surface p-3">
          <dl className="space-y-2 text-small">
            <div>
              <dt className="text-caption text-muted">Name</dt>
              <dd className="font-medium">{draft.name}</dd>
            </div>
            {draft.description ? (
              <div>
                <dt className="text-caption text-muted">Description</dt>
                <dd className="text-muted">{draft.description}</dd>
              </div>
            ) : null}
            {draft.seoTitle || draft.seoDescription ? (
              <div>
                <dt className="text-caption text-muted">Search listing (SEO)</dt>
                <dd>
                  <span className="block font-medium">{draft.seoTitle}</span>
                  <span className="block text-muted">{draft.seoDescription}</span>
                </dd>
              </div>
            ) : null}
            {draft.tags.length ? (
              <div>
                <dt className="text-caption text-muted">Tags a rule could match</dt>
                <dd className="flex flex-wrap gap-1">
                  {draft.tags.map((t) => (
                    <Badge key={t} tone="neutral">
                      {t}
                    </Badge>
                  ))}
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="text-caption text-subtle">Apply fills the form{photos.images.length ? " and uses your photo as the image" : ""}. Review it, then save.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="min-h-11 sm:min-h-8"
              onClick={() => {
                onApply(draft, photos.images[0]?.file ?? null);
                setDraft(null);
              }}
            >
              Apply to form
            </Button>
            <Button type="button" size="sm" variant="ghost" className="min-h-11 sm:min-h-8" onClick={() => setDraft(null)}>
              Discard
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
