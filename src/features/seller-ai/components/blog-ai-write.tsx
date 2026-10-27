"use client";

import { useState, useTransition } from "react";
import { PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/field";
import { Card } from "@/components/ui/layout";
import { slugify } from "@/features/catalog/variants";
import type { ContentBlock } from "@/features/content/blocks";
import { generateBlogAction } from "../actions";
import type { GenerateBlogDraft } from "../schemas";

export type BlogAiApply = (draft: {
  title: string;
  slug: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  tags: string;
  blocks: ContentBlock[];
}) => void;

function toBlocks(draft: GenerateBlogDraft): ContentBlock[] {
  return draft.blocks.map((b) => {
    if (b.type === "heading") return { type: "heading", level: b.level ?? 2, text: b.text };
    if (b.type === "list") return { type: "list", style: b.style ?? "bullet", items: b.items };
    if (b.type === "quote") return { type: "quote", text: b.text, ...(b.cite ? { cite: b.cite } : {}) };
    return { type: "paragraph", text: b.text };
  });
}

/** Dashboard blog editor: fills title, SEO and content blocks from a short topic. */
export function BlogAiWrite({ onApply }: { onApply: BlogAiApply }) {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      setNote(null);
      const r = await generateBlogAction({ topic, tone: tone || undefined });
      if (!r.ok) {
        setNote(r.error.fieldErrors?._form?.[0] ?? r.error.fieldErrors?.topic?.[0] ?? r.error.message);
        return;
      }
      const d = r.data;
      onApply({
        title: d.title,
        slug: d.slug.trim() || slugify(d.title),
        excerpt: d.excerpt,
        seoTitle: d.seoTitle || d.title.slice(0, 70),
        seoDescription: d.seoDescription || d.excerpt.slice(0, 160),
        tags: d.tags.join(", "),
        blocks: toBlocks(d),
      });
      setNote("Draft applied — review and save when ready.");
    });

  return (
    <Card
      title="AI Write"
      description="Describe the post. We draft title, SEO and body blocks you can edit before saving."
    >
      <div className="space-y-3">
        <TextAreaField
          label="Topic"
          name="aiTopic"
          rows={3}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          hint="e.g. How to style cotton kurtas for summer evenings"
        />
        <TextField label="Tone (optional)" name="aiTone" value={tone} onChange={(e) => setTone(e.target.value)} optional hint="Warm, practical, festive…" />
        {note ? (
          <p role="status" className="text-small text-muted">
            {note}
          </p>
        ) : null}
        <Button type="button" variant="secondary" size="sm" pending={pending} disabled={topic.trim().length < 3} onClick={run}>
          <PenLine aria-hidden className="size-3.5" />
          Write draft
        </Button>
      </div>
    </Card>
  );
}
