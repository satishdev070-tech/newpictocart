"use client";

import { useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Hint, Label, inputClassName as input } from "@/components/ui/field";
import { generateReviewsAction } from "@/features/seller-ai/actions";
import { AiGenerationProgress, GENERATE_REVIEWS_STEPS, type AiGenerationProgressStatus } from "./ai-generation-progress";

const SETUP_SNIPPET = "Admin → Social apps";

function formatAiError(message: string) {
  if (message.includes(SETUP_SNIPPET) || /not set up|not.?configured/i.test(message)) return message;
  return message.replace(/\s*A platform admin needs to add.*?Social apps\.?/i, "").trim() || message;
}

export function GenerateAiReviews({ products }: { products: { id: string; title: string }[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const productFieldId = useId();
  const countId = useId();
  const [product, setProduct] = useState(products[0]?.id ?? "");
  const [count, setCount] = useState<3 | 5>(3);
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [genStatus, setGenStatus] = useState<AiGenerationProgressStatus>("idle");
  const [pending, start] = useTransition();

  const open = () => {
    setError(null);
    setDoneMsg(null);
    setGenStatus("idle");
    dialogRef.current?.showModal();
  };

  const run = () => {
    if (!product) return;
    setError(null);
    setDoneMsg(null);
    setGenStatus("pending");
    start(async () => {
      const r = await generateReviewsAction({ productId: product, count, tone: "positive" });
      if (!r.ok) {
        setGenStatus("error");
        setError(formatAiError(r.error.fieldErrors?._form?.[0] ?? r.error.fieldErrors?.productId?.[0] ?? r.error.message));
        return;
      }
      setGenStatus("success");
      setDoneMsg(`${r.data.inserted} review${r.data.inserted === 1 ? "" : "s"} added as pending. Approve them when you’re ready.`);
    });
  };

  if (!products.length) {
    return (
      <Button type="button" variant="secondary" size="sm" disabled title="Add a product first">
        Generate AI Reviews
      </Button>
    );
  }

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={open}>
        Generate AI Reviews
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[min(92vw,440px)] rounded-lg border border-border bg-surface p-0 text-foreground backdrop:bg-black/40"
      >
        <div className="space-y-4 p-5">
          <div>
            <h2 id={titleId} className="text-base font-semibold">
              Generate AI Reviews
            </h2>
            <p className="mt-1 text-sm text-muted">Drafts land as pending for your approval. ~5 credits.</p>
          </div>

          <div>
            <Label htmlFor={productFieldId}>Product</Label>
            <select id={productFieldId} className={input} value={product} disabled={pending} onChange={(e) => setProduct(e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor={countId}>How many</Label>
            <select
              id={countId}
              className={input}
              value={count}
              disabled={pending}
              onChange={(e) => setCount(Number(e.target.value) === 5 ? 5 : 3)}
            >
              <option value={3}>3 reviews</option>
              <option value={5}>5 reviews</option>
            </select>
            <Hint>Tone: positive (4–5★)</Hint>
          </div>

          <AiGenerationProgress steps={GENERATE_REVIEWS_STEPS} status={genStatus} />

          {error ? (
            <p role="alert" className="rounded-md border border-error/25 bg-error/10 px-3 py-2 text-small text-error">
              {error}
            </p>
          ) : null}
          {doneMsg ? (
            <p role="status" className="rounded-md border border-success/25 bg-success/10 px-3 py-2 text-small text-success">
              {doneMsg}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()} disabled={pending}>
              {doneMsg ? "Close" : "Cancel"}
            </Button>
            {!doneMsg ? (
              <Button type="button" pending={pending} disabled={!product} onClick={run}>
                {pending ? "Generating…" : "Generate"}
              </Button>
            ) : null}
          </div>
        </div>
      </dialog>
    </>
  );
}
