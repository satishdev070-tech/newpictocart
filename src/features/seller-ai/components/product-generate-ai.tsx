"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { ImagePlus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint, Label, inputClassName as input } from "@/components/ui/field";
import { Badge, Card } from "@/components/ui/layout";
import { generateProductFromImageAction } from "@/features/seller-ai/actions";
import {
  AiGenerationProgress,
  PRODUCT_GENERATE_STEPS,
  type AiGenerationProgressStatus,
} from "@/features/seller-ai/components/ai-generation-progress";
import type { GenerateProductResult } from "@/features/seller-ai/schemas";
import { formatMoney } from "@/lib/money";

const SETUP_SNIPPET = "Admin → Social apps";
const MAX_IMAGES = 4;

type LocalImage = { key: number; file: File; preview: string };

type AiError = { kind: "setup" | "failed"; text: string };

function classifyAiError(message: string): AiError {
  const isSetup = message.includes(SETUP_SNIPPET) || /not set up|not.?configured/i.test(message);
  if (isSetup) {
    return {
      kind: "setup",
      text: message.includes(SETUP_SNIPPET)
        ? message
        : "AI writing isn't set up yet. A platform admin needs to add an NVIDIA, Gemini, Groq or Anthropic API key in Admin → Social apps.",
    };
  }
  const cleaned =
    message.replace(/\s*A platform admin needs to add.*?Social apps\.?/i, "").trim() || message;
  return {
    kind: "failed",
    text: cleaned || "The AI service didn't return a usable answer. Please try again in a minute.",
  };
}

/**
 * Generate with AI for the product editor. New products have no media until save, so this accepts
 * local File uploads (up to 4) and/or https image URLs from ProductMediaManager after save.
 * Drafts land in a preview; Apply writes into the form (never silent-overwrite on generate).
 */
export function ProductGenerateAi({
  imageUrls,
  onApply,
}: {
  imageUrls: string[];
  onApply: (result: GenerateProductResult) => void;
}) {
  const fileId = useId();
  const hintId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const nextKey = useRef(0);
  const [images, setImages] = useState<LocalImage[]>([]);
  const [hint, setHint] = useState("");
  const [error, setError] = useState<AiError | null>(null);
  const [preview, setPreview] = useState<GenerateProductResult | null>(null);
  const [genStatus, setGenStatus] = useState<AiGenerationProgressStatus>("idle");
  const [pending, start] = useTransition();

  useEffect(() => {
    return () => {
      for (const img of images) URL.revokeObjectURL(img.preview);
    };
    // Only revoke on unmount; per-remove handlers revoke individually.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasPhoto = images.length > 0 || imageUrls.length > 0;
  const hintReady = hint.trim().length >= 3;
  const canGenerate = hasPhoto || hintReady;
  const slotsLeft = MAX_IMAGES - images.length;

  const addFiles = (list: FileList | null) => {
    if (!list || slotsLeft <= 0) return;
    const accepted = Array.from(list)
      .filter((f) => /^image\/(png|jpeg|webp)$/i.test(f.type) || /\.(png|jpe?g|webp)$/i.test(f.name))
      .slice(0, slotsLeft)
      .map((file) => ({
        key: nextKey.current++,
        file,
        preview: URL.createObjectURL(file),
      }));
    if (!accepted.length) return;
    setImages((prev) => [...prev, ...accepted].slice(0, MAX_IMAGES));
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (key: number) => {
    setImages((prev) => {
      const gone = prev.find((i) => i.key === key);
      if (gone) URL.revokeObjectURL(gone.preview);
      return prev.filter((i) => i.key !== key);
    });
  };

  const clearImages = () => {
    setImages((prev) => {
      for (const img of prev) URL.revokeObjectURL(img.preview);
      return [];
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  const run = () => {
    if (!canGenerate) return;
    setError(null);
    setPreview(null);
    setGenStatus("pending");
    start(async () => {
      const r = await generateProductFromImageAction({
        imageUrls,
        hint: hint.trim() || undefined,
        images: images.map((i) => i.file),
      });
      if (!r.ok) {
        setError(classifyAiError(r.error.fieldErrors?._form?.[0] ?? r.error.message));
        setPreview(null);
        setGenStatus("error");
        return;
      }
      setPreview(r.data);
      setGenStatus("success");
    });
  };

  const apply = () => {
    if (!preview) return;
    onApply(preview);
    setPreview(null);
    setGenStatus("idle");
  };

  const discard = () => {
    setPreview(null);
    setGenStatus("idle");
  };

  return (
    <Card
      title={
        <span className="inline-flex items-center gap-2">
          <Sparkles aria-hidden className="size-4 text-accent" />
          Generate with AI
        </span>
      }
      description="Upload up to 4 product photos or add a short hint. Review the draft before applying it to the form."
      actions={<Badge tone="neutral">~8 credits</Badge>}
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor={fileId}>Product photos</Label>
          <input
            id={fileId}
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => addFiles(e.target.files)}
          />

          {images.length ? (
            <ul className="mb-2 grid grid-cols-4 gap-2 sm:grid-cols-4">
              {images.map((img) => (
                <li key={img.key} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-secondary">
                  {/* Local object URL preview only; never uploaded until generate. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.preview} alt="" className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(img.key)}
                    className="absolute top-1 right-1 grid size-6 place-items-center rounded-md bg-surface/90 text-muted shadow-xs ring-1 ring-border hover:text-foreground"
                    aria-label={`Remove ${img.file.name}`}
                  >
                    <X aria-hidden className="size-3.5" />
                  </button>
                </li>
              ))}
              {slotsLeft > 0 ? (
                <li>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="grid aspect-square size-full place-items-center rounded-lg border border-dashed border-border bg-surface-secondary text-muted hover:border-border-strong hover:text-foreground"
                    aria-label="Add more photos"
                  >
                    <ImagePlus aria-hidden className="size-5" />
                  </button>
                </li>
              ) : null}
            </ul>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={slotsLeft <= 0}>
              <ImagePlus aria-hidden className="size-4" />
              {images.length ? (slotsLeft ? "Add photos" : "Photo limit reached") : "Choose photos"}
            </Button>
            {images.length ? (
              <>
                <span className="text-small text-muted">
                  {images.length} of {MAX_IMAGES} photo{images.length === 1 ? "" : "s"}
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={clearImages}>
                  Clear
                </Button>
              </>
            ) : null}
          </div>
          {imageUrls.length ? (
            <Hint>
              {imageUrls.length} saved gallery image{imageUrls.length === 1 ? "" : "s"} (https) will also be sent
              {images.length ? " with your uploads" : ""}.
            </Hint>
          ) : (
            <Hint>New products have no media until you save — upload photos here (up to {MAX_IMAGES}), or write a hint.</Hint>
          )}
        </div>

        <div>
          <Label htmlFor={hintId} optional>
            Hint
          </Label>
          <input
            id={hintId}
            className={input}
            value={hint}
            maxLength={500}
            placeholder="e.g. cotton kurta for festive wear, mid-range"
            onChange={(e) => setHint(e.target.value)}
          />
          {!canGenerate ? (
            <Hint>Add product photos or a hint of at least 3 characters to enable Generate.</Hint>
          ) : !hasPhoto && hintReady ? (
            <Hint>Generating from hint only — photos usually improve the draft.</Hint>
          ) : null}
        </div>

        {error ? (
          <div role="alert" className="rounded-md border border-error/25 bg-error/10 px-3 py-2 text-small text-error">
            <p className="font-medium">{error.kind === "setup" ? "AI isn't set up" : "Generation failed"}</p>
            <p className="mt-0.5">{error.text}</p>
          </div>
        ) : null}

        <AiGenerationProgress steps={PRODUCT_GENERATE_STEPS} status={genStatus} />

        <Button type="button" variant="secondary" pending={pending} disabled={!canGenerate} onClick={run} className="w-full sm:w-auto">
          <Sparkles aria-hidden className="size-4" />
          {pending ? "Generating…" : "Generate with AI"}
        </Button>

        {preview ? (
          <div className="space-y-3 rounded-lg border border-border bg-surface-secondary/40 p-3">
            <p className="text-label">Preview</p>
            <dl className="space-y-2 text-small">
              <div>
                <dt className="text-caption text-muted">Title</dt>
                <dd className="font-medium">{preview.title}</dd>
              </div>
              {preview.shortDescription ? (
                <div>
                  <dt className="text-caption text-muted">Short description</dt>
                  <dd className="text-muted">{preview.shortDescription}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-caption text-muted">Suggested price</dt>
                <dd className="tabular-nums">{preview.priceMinor > 0 ? formatMoney(preview.priceMinor) : "—"}</dd>
              </div>
              {preview.tags.length ? (
                <div>
                  <dt className="text-caption text-muted">Tags</dt>
                  <dd className="flex flex-wrap gap-1">
                    {preview.tags.map((t) => (
                      <Badge key={t} tone="neutral">
                        {t}
                      </Badge>
                    ))}
                  </dd>
                </div>
              ) : null}
              {preview.seoTitle || preview.seoDescription ? (
                <div>
                  <dt className="text-caption text-muted">Search listing (SEO)</dt>
                  <dd>
                    <span className="block font-medium">{preview.seoTitle}</span>
                    <span className="block text-muted">{preview.seoDescription}</span>
                  </dd>
                </div>
              ) : null}
              {preview.description ? (
                <div>
                  <dt className="text-caption text-muted">Description</dt>
                  <dd className="line-clamp-4 whitespace-pre-line text-muted">{preview.description}</dd>
                </div>
              ) : null}
            </dl>
            <p className="text-caption text-subtle">Apply fills the title, descriptions, price, tags, category, type and SEO fields. You can edit everything before saving.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={apply}>
                Apply to form
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={discard}>
                Discard
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
