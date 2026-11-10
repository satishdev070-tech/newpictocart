import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { productInputSchema } from "@/features/catalog/schemas";
import { mapStartFinalizeError } from "@/features/start/finalize-error";
import { toDecimalString } from "@/lib/money";

/** Mirrors ensureProducts payload in onboarding/seed/persist.ts (minus DB ids). */
function seedProductPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: "Sample Kurta",
    slug: "sample-kurta",
    description: "A warm cotton kurta",
    shortDescription: "Cotton kurta",
    productType: "apparel",
    brand: "Test Store",
    categoryId: null,
    status: "active" as const,
    countryOfOrigin: "India",
    featured: true,
    tags: ["bestseller"],
    attributes: { occasion: [], specs: [] },
    careInstructions: null,
    shippingInfo: null,
    returnInfo: null,
    hsnCode: "6109",
    seoTitle: "Sample Kurta | Test Store",
    seoDescription: "Cotton kurta",
    options: [],
    variants: [
      {
        option1: null,
        option2: null,
        option3: null,
        sku: "SEED-01",
        price: toDecimalString(149900),
        compareAtPrice: "",
        weightGrams: "400",
        trackInventory: true,
        lowStockThreshold: "3",
        initialStock: "10",
        status: "active" as const,
      },
    ],
    ...overrides,
  };
}

describe("onboarding seed products", () => {
  it("accepts active seed products with countryOfOrigin India", () => {
    const parsed = productInputSchema.parse(seedProductPayload());
    expect(parsed.status).toBe("active");
    expect(parsed.countryOfOrigin).toBe("India");
  });

  it("rejects active seed products missing countryOfOrigin (regression lock)", () => {
    const r = productInputSchema.safeParse(seedProductPayload({ countryOfOrigin: "" }));
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.map((i) => i.path.join("."))).toEqual(expect.arrayContaining(["countryOfOrigin"]));
    }
  });

  it("maps seed_save_product INTERNAL (e.g. Zod wrap) to a clear finalize toast", () => {
    const wrapped = new AppError("INTERNAL", {
      context: { operation: "seed_save_product", reason: "seed_product_parse" },
      cause: new ZodError([]),
    });
    const mapped = mapStartFinalizeError(wrapped);
    expect(mapped.fieldErrors?._form?.[0]).toMatch(/sample products/i);
  });
});
