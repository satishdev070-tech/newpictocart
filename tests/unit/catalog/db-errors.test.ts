import { describe, expect, it } from "vitest";
import { catalogDbError } from "@/features/catalog/server/db-errors";

describe("catalogDbError", () => {
  it("maps save_product hints to actionable fieldErrors", () => {
    const stale = catalogDbError({ code: "P0001", message: "product was changed", hint: "STALE_PRODUCT" });
    expect(stale.code).toBe("CONFLICT");
    expect(stale.fieldErrors?._form?.[0]).toMatch(/Reload the page/);

    const noActive = catalogDbError({ code: "22023", message: "an active product needs at least one active variant", hint: "NO_ACTIVE_VARIANT" });
    expect(noActive.fieldErrors?.status?.[0]).toMatch(/active variant/);
    expect(noActive.fieldErrors?.variants?.[0]).toMatch(/Active/);

    const count = catalogDbError({ code: "22023", message: "between 1 and 250 variants", hint: "VARIANT_COUNT" });
    expect(count.fieldErrors?.variants?.[0]).toMatch(/250/);

    const opts = catalogDbError({ code: "22023", message: "option 1 has no values", hint: "OPTION_VALUES" });
    expect(opts.fieldErrors?.options?.[0]).toMatch(/name and at least one value/);
  });

  it("recovers hints from bare SQL messages when hint is missing", () => {
    const r = catalogDbError({ code: "22023", message: "variant 2 has an invalid value for option 1" });
    expect(r.fieldErrors?.variants?.[0]).toMatch(/Generate variants/);
  });

  it("maps SKU uniqueness and MRP check constraints onto the Variants card", () => {
    const sku = catalogDbError({ code: "23505", message: 'duplicate key value violates unique constraint "product_variants_sku_key"' });
    expect(sku.fieldErrors?.variants?.[0]).toMatch(/SKU/);

    const mrp = catalogDbError({ code: "23514", message: 'new row for relation "product_variants" violates check constraint "product_variants_compare_at_check"' });
    expect(mrp.fieldErrors?.variants?.[0]).toMatch(/MRP/);
  });

  it("never leaves sellers with a bare VALIDATION and no fieldErrors for catalog SQL", () => {
    const bare = catalogDbError({ code: "22023", message: "invalid payload" });
    expect(bare.code).toBe("VALIDATION");
    expect(bare.fieldErrors?._form?.length).toBeGreaterThan(0);

    const missingVariant = catalogDbError({ code: "P0002", message: "variant not found" });
    expect(missingVariant.fieldErrors?.variants?.[0]).toMatch(/Reload/);
  });
});
