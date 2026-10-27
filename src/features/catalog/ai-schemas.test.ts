import { describe, expect, it } from "vitest";
import { GENERATE_PRODUCT_CREDIT_KIND, generateProductInputSchema, generatedProductSchema } from "./ai-schemas";

describe("generateProductInputSchema", () => {
  it("requires at least one image URL or base64 image", () => {
    const empty = generateProductInputSchema.safeParse({});
    expect(empty.success).toBe(false);
  });

  it("accepts https image URLs", () => {
    const ok = generateProductInputSchema.safeParse({
      imageUrls: ["https://example.com/p.jpg"],
      hints: { title: "Silk saree" },
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.imageUrls).toHaveLength(1);
  });

  it("accepts base64 images without URLs", () => {
    const ok = generateProductInputSchema.safeParse({
      images: [{ mimeType: "image/jpeg", data: "a".repeat(40) }],
    });
    expect(ok.success).toBe(true);
  });
});

describe("generatedProductSchema", () => {
  it("parses a full product payload", () => {
    const ok = generatedProductSchema.safeParse({
      title: "Cotton Kurta",
      shortDescription: "Breathable everyday kurta",
      description: "Soft cotton.\n\n- Hand wash",
      categorySuggestions: ["Kurtas"],
      tags: ["cotton", "kurta"],
      attributes: {
        fabric: "Cotton",
        style: "Straight",
        length: "Knee",
        work: "",
        pattern: "Solid",
        occasion: ["Casual"],
        specs: [{ label: "Fit", value: "Regular" }],
      },
      seoTitle: "Cotton Kurta",
      seoDescription: "Shop the cotton kurta",
      brand: "",
      careInstructions: "Hand wash",
      productTypeHint: "kurta",
      priceHintPaise: 129900,
    });
    expect(ok.success).toBe(true);
  });
});

describe("GENERATE_PRODUCT_CREDIT_KIND", () => {
  it("matches ai_credit_action_costs kind", () => {
    expect(GENERATE_PRODUCT_CREDIT_KIND).toBe("generate_product");
  });
});
