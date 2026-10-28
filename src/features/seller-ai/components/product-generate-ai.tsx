"use client";

import { useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Hint, Label, inputClassName as input } from "@/components/ui/field";
import { Badge, Card } from "@/components/ui/layout";
import { generateProductFromImageAction } from "@/features/seller-ai/actions";
import type { GenerateProductResult } from "@/features/seller-ai/schemas";
import { formatMoney } from "@/lib/money";

const SETUP_SNIPPET = "Admin → Social apps";

function formatAiError(message: string) {
  // Keep Admin → Social apps guidance only for the platform setup / not-configured copy.
  if (message.includes(SETUP_SNIPPET) || /not set up|not.?configured/i.test(message)) return message;
  return message.replace(/\s*A platform admin needs to add.*?Social apps\.?/i, "").trim() || message;
}

/**
 * Generate with AI for the product editor. New products have no media until save, so this accepts
 * a local File upload and/or https image URLs from ProductMediaManager after save.
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
  const [files, setFiles] = useState<File[]>([]);
  const [hint, setHint] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<GenerateProductResult | null>(null);
  const [pending, start] = useTransition();

  const hasPhoto = files.length > 0 || imageUrls.length > 0;
  const hintReady = hint.trim().length >= 3;
  const canGenerate = hasPhoto || hintReady;

  const clearFiles = () => {
    setFiles([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const run = () => {
    if (!canGenerate) return;
    setError(null);
    start(async () => {
      const r = await generateProductFromImageAction({
        imageUrls,
        hint: hint.trim() || undefined,
        images: files,
      });
      if (!r.ok) {
        setError(formatAiError(r.error.fieldErrors?._form?.[0] ?? r.error.message));
        setPreview(null);
        return;
      }
      setPreview(r.data);
    });
  };

  const apply = () => {
    if (!preview) return;
    onApply(preview);
    setPreview(null);
  };

  const discard = () => setPreview(null);

  const fileLabel =
    files.length === 0 ? null : files.length === 1 ? files[0]!.name : `${files[0]!.name} +${files.length - 1} more`;

  return (
    <Card
      title="Generate with AI"
      description="Upload a photo or add a short hint. Review the draft before applying it to the form."
      actions={<Badge tone="neutral">~8 credits</Badge>}
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor={fileId}>Product photo</Label>
          <input
            id={fileId}
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files).slice(0, 4) : [])}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              {files.length ? "Change photo" : "Choose photo"}
            </Button>
            {fileLabel ? (
              <>
                <span className="max-w-[14rem] truncate text-small text-muted" title={files.map((f) => f.name).join(", ")}>
                  {fileLabel}
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={clearFiles}>
                  Clear
                </Button>
              </>
            ) : null}
          </div>
          {imageUrls.length ? (
            <Hint>
              {imageUrls.length} saved gallery image{imageUrls.length === 1 ? "" : "s"} (https) will also be sent.
            </Hint>
          ) : (
            <Hint>New products have no media until you save — upload a photo here, or write a hint.</Hint>
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
            <Hint>Add a product photo or a hint of at least 3 characters to enable Generate.</Hint>
          ) : !hasPhoto && hintReady ? (
            <Hint>Generating from hint only — a photo usually improves the draft.</Hint>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="rounded-md border border-error/25 bg-error/10 px-3 py-2 text-small text-error">
            {error}
          </p>
        ) : null}

        <Button type="button" variant="secondary" pending={pending} disabled={!canGenerate} onClick={run} className="w-full sm:w-auto">
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
