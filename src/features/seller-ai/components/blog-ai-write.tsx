"use client";

import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Hint, Label, inputClassName as input } from "@/components/ui/field";
import { Badge, Card } from "@/components/ui/layout";
import { generateBlogAction } from "@/features/seller-ai/actions";
import type { ContentBlock } from "@/features/content/blocks";

const SETUP_SNIPPET = "Admin → Social apps";

function formatAiError(message: string) {
  if (message.includes(SETUP_SNIPPET) || /not set up|not.?configured/i.test(message)) return message;
  return message.replace(/\s*A platform admin needs to add.*?Social apps\.?/i, "").trim() || message;
}

export function BlogAiWrite({
  onApply,
}: {
  onApply: (draft: { title: string; excerpt: string; tags: string; seoTitle: string; seoDescription: string; blocks: ContentBlock[] }) => void;
}) {
  const topicId = useId();
  const [topic, setTopic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [pending, start] = useTransition();

  const topicReady = topic.trim().length >= 3;

  const run = () => {
    if (!topicReady) return;
    setError(null);
    setApplied(false);
    start(async () => {
      const r = await generateBlogAction({ topic });
      if (!r.ok) {
        setError(formatAiError(r.error.fieldErrors?._form?.[0] ?? r.error.fieldErrors?.topic?.[0] ?? r.error.message));
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
      setApplied(true);
    });
  };

  return (
    <Card
      title="AI Write"
      description="Describe the post topic. Review the draft before publishing."
      actions={<Badge tone="neutral">~5 credits</Badge>}
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor={topicId}>Topic</Label>
          <input
            id={topicId}
            className={input}
            value={topic}
            maxLength={300}
            placeholder="e.g. How to style cotton kurtas this festive season"
            onChange={(e) => {
              setTopic(e.target.value);
              setApplied(false);
            }}
          />
          {!topicReady ? <Hint>Enter at least 3 characters to enable AI Write.</Hint> : null}
        </div>

        {error ? (
          <p role="alert" className="rounded-md border border-error/25 bg-error/10 px-3 py-2 text-small text-error">
            {error}
          </p>
        ) : null}

        <Button type="button" variant="secondary" pending={pending} disabled={!topicReady} onClick={run} className="w-full sm:w-auto">
          {pending ? "Writing…" : "AI Write"}
        </Button>

        {applied && !error ? (
          <p role="status" className="rounded-md border border-success/25 bg-success/10 px-3 py-2 text-small text-success">
            Draft applied to the form. Review title, SEO and content before publishing.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
