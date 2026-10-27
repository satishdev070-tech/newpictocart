import { describe, expect, it } from "vitest";
import { contactReplyDraftSchema, contactReplyInput, generateBlogDraftSchema, generateBlogInput } from "@/features/seller-ai/schemas";

describe("seller AI Phase 2 schemas", () => {
  it("accepts a blog draft with content blocks", () => {
    const r = generateBlogDraftSchema.parse({
      title: "Summer kurtas",
      slug: "summer-kurtas",
      excerpt: "Light cotton looks for warm evenings.",
      seoTitle: "Summer kurtas",
      seoDescription: "How to style cotton kurtas.",
      tags: ["kurtas", "summer"],
      blocks: [
        { type: "heading", level: 2, text: "Start with breathable cotton" },
        { type: "paragraph", text: "Pick mid-weight fabric that holds shape." },
        { type: "list", style: "bullet", items: ["Pastels", "Block prints", "Soft neutrals"] },
      ],
    });
    expect(r.blocks).toHaveLength(3);
    expect(r.tags[0]).toBe("kurtas");
  });

  it("rejects short blog topics and empty replies", () => {
    expect(generateBlogInput.safeParse({ topic: "ab" }).success).toBe(false);
    expect(generateBlogInput.parse({ topic: "Festive gifting ideas for Diwali" }).tone).toBeUndefined();
    expect(contactReplyDraftSchema.safeParse({ reply: "" }).success).toBe(false);
    expect(contactReplyInput.safeParse({ messageId: "not-a-uuid" }).success).toBe(false);
  });
});
