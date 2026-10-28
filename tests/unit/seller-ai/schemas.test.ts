import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  businessCoachContentSchema,
  businessCoachResultSchema,
  contactReplyContentSchema,
  contactReplyResultSchema,
  generateBlogContentSchema,
  generateBlogResultSchema,
  generateProductContentSchema,
  generateProductInputSchema,
  generateProductResultSchema,
  SELLER_AI_CREDIT_KINDS,
  toContentBlocks,
} from "@/features/seller-ai/schemas";

const MIGRATION = [
  readFileSync(new URL("../../../supabase/migrations/20261028004200_seller_ai_suite.sql", import.meta.url), "utf8"),
  readFileSync(new URL("../../../supabase/migrations/20261028004300_nvidia_provider_store_agent.sql", import.meta.url), "utf8"),
].join("\n");

describe("seller AI schemas", () => {
  it("accepts product input with https images or a hint", () => {
    expect(generateProductInputSchema.parse({ imageUrls: ["https://example.com/a.jpg"], hint: "" }).imageUrls).toHaveLength(1);
    expect(generateProductInputSchema.parse({ hint: "cotton kurta" }).hint).toBe("cotton kurta");
    expect(generateProductInputSchema.safeParse({ imageUrls: ["http://insecure.example/a.jpg"] }).success).toBe(false);
  });

  it("parses product content and result with integer paise", () => {
    const content = generateProductContentSchema.parse({
      title: "Silk Saree",
      description: "Handwoven silk.",
      shortDescription: "Festive silk saree",
      tags: ["saree", "silk"],
      priceMinor: 249900,
      productTypeHint: "saree",
      categoryHint: null,
      seoTitle: "Silk Saree",
      seoDescription: "Handwoven",
    });
    expect(content.priceMinor).toBe(249900);
    const r = generateProductResultSchema.parse({ ...content, provider: "gemini", model: "gemini-2.0-flash", tokens: 120 });
    expect(r.provider).toBe("gemini");
  });

  it("softens blog blocks into content blocks", () => {
    const r = generateBlogResultSchema.parse({
      title: "Festive styling",
      excerpt: "Tips",
      tags: ["style"],
      seoTitle: "Festive styling",
      seoDescription: "Tips for festive wear",
      blocks: [
        { type: "heading", level: 2, text: "Start here" },
        { type: "paragraph", text: "Keep it simple." },
        { type: "list", style: "bullet", items: ["One", "Two"] },
      ],
      provider: "groq",
      model: "llama",
    });
    expect(toContentBlocks(r.blocks)).toHaveLength(3);
  });

  it("parses contact reply and coach payloads", () => {
    expect(contactReplyContentSchema.parse({ reply: "Thanks for writing.", subject: "Re: Hello" }).reply).toContain("Thanks");
    expect(contactReplyResultSchema.parse({ reply: "Thanks for writing.", subject: "Re: Hello", provider: "anthropic", model: "claude" }).reply).toContain("Thanks");
    expect(generateBlogContentSchema.safeParse({ title: "T", excerpt: "", tags: [], seoTitle: "", seoDescription: "", blocks: [{ type: "paragraph", text: "Hi" }] }).success).toBe(true);
    expect(
      businessCoachResultSchema.parse({
        headline: "Ship faster",
        focus: "Clear the fulfilment queue",
        tips: [{ title: "Pack orders", detail: "You have unfulfilled orders.", priority: "high" }],
        provider: "gemini",
        model: "g",
      }).tips,
    ).toHaveLength(1);
    expect(businessCoachContentSchema.safeParse({ headline: "H", focus: "F", tips: [{ title: "T", detail: "D", priority: "low" }] }).success).toBe(true);
  });

  it("seeds every seller AI credit kind in the migration", () => {
    for (const k of SELLER_AI_CREDIT_KINDS) expect(MIGRATION).toContain(`('${k}',`);
    expect(MIGRATION).toContain("generate_product");
    expect(MIGRATION).toContain("catalog.write");
  });
});
