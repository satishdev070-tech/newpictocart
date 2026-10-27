"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { inputClassName as input } from "@/components/ui/field";
import { generateBlogAction } from "@/features/seller-ai/actions";
import type { ContentBlock } from "@/features/content/blocks";

export function BlogAiWrite({
  onApply,
}: {
  onApply: (draft: { title: string; excerpt: string; tags: string; seoTitle: string; seoDescription: string; blocks: ContentBlock[] }) => void;
}) {
  const [topic, setTopic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = () => {
    setError(null);
    start(async () => {
      const r = await generateBlogAction({ topic });
      if (!r.ok) {
        setError(r.error.fieldErrors?._form?.[0] ?? r.error.fieldErrors?.topic?.[0] ?? r.error.message);
        return;
      }
      onApply({
        title: r.data.title,
        excerpt: r.data.excerpt,
        tags: r.data.tags.join(", "),
        seoTitle: r.data.seoTitle,
        seoDescription: r.data.seoDescription,
        blocks: r.data.contentBlocks,
      });
    });
  };

  return (
    <div className="space-y-3 rounded-md border border-border bg-surface-secondary/40 p-3">
      <div>
        <p className="text-sm font-medium">AI Write</p>
        <p className="text-caption text-muted">Describe the post topic. Uses AI credits; review before publishing.</p>
      </div>
      <div>
        <label htmlFor="ai-blog-topic" className="mb-1 block text-sm font-medium">
          Topic
        </label>
        <input id="ai-blog-topic" className={input} value={topic} maxLength={300} placeholder="e.g. How to style cotton kurtas this festive season" onChange={(e) => setTopic(e.target.value)} />
      </div>
      <Button type="button" variant="secondary" pending={pending} onClick={run} disabled={topic.trim().length < 3}>
        {pending ? "Writing…" : "AI Write"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
