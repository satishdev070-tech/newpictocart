import { afterEach, describe, expect, it } from "vitest";
import { buildFallbackReadyStorePlan } from "@/features/onboarding/seed/fallback";
import { readyStorePlanSchema, type ReadyStorePlan } from "@/features/onboarding/seed/schemas";
import { parseSeedProduct, sanitizeSeedTags, seedSku } from "@/features/onboarding/seed/product-input";
import { defaultTypeForIndustry } from "@/features/catalog/product-types";
import { INDUSTRY_SLUGS, type IndustrySlug } from "@/features/stores/industries";
import { subcategoriesFor } from "@/features/stores/subcategories";
import { finalizeOnce, isFinalizeInFlight, resetFinalizeOnce } from "@/features/start/finalize-once";

function parseAll(plan: ReadyStorePlan, industry: IndustrySlug, storeName = "Kia Jewels") {
  return plan.products.map((product, index) =>
    parseSeedProduct({ product, index, storeName, productType: defaultTypeForIndustry(industry), categoryId: null }),
  );
}

describe("seed product input (store-creation regression, 2026-11-16)", () => {
  it("owner repro: Jewellery + Fashion jewellery + Bridal sets, noida — every sample product is valid", () => {
    const plan = readyStorePlanSchema.parse(
      buildFallbackReadyStorePlan({ storeName: "Kia Jewels", industry: "jewellery", subcategory: "imitation", niche: "sub:bridal" }),
    );
    const results = parseAll(plan, "jewellery");
    expect(results.every((r) => r.ok)).toBe(true);
    const skus = results.map((r) => (r.ok ? r.input.variants[0]!.sku : null));
    expect(new Set(skus).size).toBe(skus.length);
  });

  it("every industry × subcategory fallback plan parses as active products with countryOfOrigin", () => {
    for (const industry of INDUSTRY_SLUGS) {
      const subs = [null, ...subcategoriesFor(industry).map((s) => s.slug)];
      for (const sub of subs) {
        const plan = readyStorePlanSchema.parse(buildFallbackReadyStorePlan({ storeName: "Test Store", industry, subcategory: sub }));
        for (const r of parseAll(plan, industry, "Test Store")) {
          if (!r.ok) throw new Error(`${industry}/${sub}: ${JSON.stringify(r.issues)}`);
          expect(r.input.status).toBe("active");
          expect(r.input.countryOfOrigin).toBe("India");
        }
      }
    }
  });

  it("normalises AI plan fields the catalog schema rejects (tags, long titles/SEO, MRP below price)", () => {
    const plan = readyStorePlanSchema.parse(
      buildFallbackReadyStorePlan({ storeName: "Kia Jewels", industry: "jewellery", subcategory: "bridal" }),
    );
    const messy = {
      ...plan.products[0]!,
      title: "Kundan bridal set ".repeat(11).trim().slice(0, 200),
      tags: ["gold-plated, kundan", "gift (for her)", 'say "yes"', "Bridal", "bridal"],
      seoTitle: "x".repeat(120),
      seoDescription: "y".repeat(320),
      pricePaise: 250000,
      compareAtPaise: 199900,
    };
    const r = parseSeedProduct({ product: messy, index: 0, storeName: "A store with a rather long name", productType: "jewellery_set", categoryId: null });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.input.title.length).toBeLessThanOrEqual(200);
      expect(r.input.tags).toEqual(["gold-plated kundan", "gift for her", "say yes", "bridal"]);
      expect(r.input.variants[0]!.compareAtPrice).toBeNull();
    }
  });

  it("sanitizeSeedTags falls back when every tag is unusable", () => {
    expect(sanitizeSeedTags(["(),", "  "], ["bestseller"])).toEqual(["bestseller"]);
  });

  it("seed SKUs follow the slug so a retried finalize with a different plan can't collide", () => {
    expect(seedSku("bridal-kundan-set", 0)).toBe("SEED-BRIDAL-KUNDAN-SET");
    expect(seedSku("", 2)).toBe("SEED-03");
    expect(seedSku("a".repeat(80), 0).length).toBeLessThanOrEqual(64);
  });
});

describe("finalizeOnce (double finalize after OTP remount)", () => {
  afterEach(() => resetFinalizeOnce());

  it("shares one in-flight call between remounted callers", async () => {
    let calls = 0;
    let release!: (v: string) => void;
    const run = () => {
      calls += 1;
      return new Promise<string>((resolve) => (release = resolve));
    };
    const a = finalizeOnce(run);
    const b = finalizeOnce(run);
    expect(isFinalizeInFlight()).toBe(true);
    release("ok");
    await expect(Promise.all([a, b])).resolves.toEqual(["ok", "ok"]);
    expect(calls).toBe(1);
    expect(isFinalizeInFlight()).toBe(false);
  });

  it("allows a retry after a failure", async () => {
    await expect(finalizeOnce(() => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    await expect(finalizeOnce(() => Promise.resolve(2))).resolves.toBe(2);
  });
});
