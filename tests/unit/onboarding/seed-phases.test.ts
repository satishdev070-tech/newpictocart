import { describe, expect, it } from "vitest";
import { parseCachedSeedPlan, SEED_PLAN_AUDIT_ACTION } from "@/features/onboarding/seed/phase-rules";
import { buildFallbackReadyStorePlan } from "@/features/onboarding/seed/fallback";
import { assignSeedPhotos, pickSeedImageBatch, seedPhotoFilename, wantedSeedPhotos } from "@/features/onboarding/seed/images";

describe("seed plan cache (audit metadata)", () => {
  it("uses a valid cached plan and ignores missing or broken ones", () => {
    const plan = buildFallbackReadyStorePlan({ storeName: "Kia Crafts", industry: "handicrafts" });
    expect(SEED_PLAN_AUDIT_ACTION).toMatch(/^[a-z_]+(\.[a-z_]+)+$/);
    expect(parseCachedSeedPlan({ plan })?.categories).toHaveLength(plan.categories.length);
    expect(parseCachedSeedPlan(null)).toBeNull();
    expect(parseCachedSeedPlan({})).toBeNull();
    expect(parseCachedSeedPlan({ plan: { ...plan, products: [] } })).toBeNull();
  });
});

describe("seed image batches", () => {
  it("takes at most 4 photos not imported or skipped, and counts the rest", () => {
    const wanted = ["a", "b", "c", "d", "e", "f", "g"];
    expect(pickSeedImageBatch(wanted, new Set(), new Set())).toEqual({ batch: ["a", "b", "c", "d"], remainingAfter: 3 });
    // A retry after a killed request reuses photos already in the media library.
    expect(pickSeedImageBatch(wanted, new Set(["a", "b", "c"]), new Set(["d"]))).toEqual({ batch: ["e", "f", "g"], remainingAfter: 0 });
    expect(pickSeedImageBatch(wanted, new Set(wanted), new Set())).toEqual({ batch: [], remainingAfter: 0 });
  });

  it("only wants photos for rows still missing one, hero first, without duplicates", () => {
    const assignment = assignSeedPhotos("fashion", { products: 2, categories: 1, collections: 1, blogs: 1 });
    const rows = {
      products: [
        { id: "p1", missing: true },
        { id: "p2", missing: false },
      ],
      categories: [{ id: "c1", missing: true }],
      collections: [{ id: "k1", missing: false }],
      blogs: [{ id: "b1", missing: false }],
    };
    const wanted = wantedSeedPhotos(rows, assignment).map((p) => p.id);
    expect(wanted[0]).toBe(assignment.hero!.id);
    expect(wanted).toContain(assignment.products[0]!.id);
    expect(wanted).toContain(assignment.categories[0]!.id);
    expect(new Set(wanted).size).toBe(wanted.length);
    expect(seedPhotoFilename({ id: "abc" })).toBe("abc.jpg");
  });
});
