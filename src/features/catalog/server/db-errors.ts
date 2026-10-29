import "server-only";
import { AppError } from "@/lib/errors";
import { mapDbError } from "@/lib/supabase/errors";

type PgError = { code?: string; message?: string; hint?: string; details?: string } | null | undefined;

/** Seller-facing copy for save_product / catalog SQL hints (also matched from bare messages). */
const HINTS: Record<string, { fields: Record<string, string[]>; code?: "VALIDATION" | "CONFLICT" }> = {
  STALE_PRODUCT: {
    code: "CONFLICT",
    fields: { _form: ["This product was changed by someone else. Reload the page to see the latest version."] },
  },
  NO_ACTIVE_VARIANT: {
    fields: {
      status: ["An active product needs at least one active variant."],
      variants: ["Turn on Active for at least one variant, or save the product as a draft."],
    },
  },
  VARIANT_OPTIONS: {
    fields: { variants: ["Every variant needs a value that matches each option. Generate variants again after editing options."] },
  },
  DUPLICATE_VARIANT: {
    fields: { variants: ["Two variants have the same option values. Remove the duplicate or change an option value."] },
  },
  OPTION_VALUES: {
    fields: { options: ["Every option needs a name and at least one value."] },
  },
  VARIANT_COUNT: {
    fields: { variants: ["A product needs between 1 and 250 variants (exactly one when it has no options)."] },
  },
  TOO_MANY_OPTIONS: {
    fields: { options: ["Use at most 3 options."] },
  },
};

const HINT_KEYS = Object.keys(HINTS);

function resolveHint(error: PgError): string | null {
  const hint = (error?.hint ?? "").trim();
  if (hint && HINTS[hint]) return hint;
  const msg = error?.message ?? "";
  // PostgREST occasionally omits HINT; recover from the exception text.
  for (const key of HINT_KEYS) {
    if (msg.includes(key)) return key;
  }
  if (/product was changed by someone else/i.test(msg)) return "STALE_PRODUCT";
  if (/at least one active variant/i.test(msg)) return "NO_ACTIVE_VARIANT";
  if (/invalid value for option|option .* which does not exist/i.test(msg)) return "VARIANT_OPTIONS";
  if (/duplicate variant/i.test(msg)) return "DUPLICATE_VARIANT";
  if (/has no values/i.test(msg)) return "OPTION_VALUES";
  if (/between 1 and 250 variants|exactly one variant/i.test(msg)) return "VARIANT_COUNT";
  if (/at most 3 options/i.test(msg)) return "TOO_MANY_OPTIONS";
  return null;
}

/**
 * Catalog-specific DB error mapping. Messages go into fieldErrors (the only custom text
 * that reaches the client); everything else falls back to the shared mapDbError().
 */
export function catalogDbError(error: PgError, context?: Record<string, unknown>): AppError {
  const msg = error?.message ?? "";
  const code = error?.code ?? "";
  const resolved = resolveHint(error);
  if (resolved) {
    const mapped = HINTS[resolved]!;
    return new AppError(mapped.code ?? "VALIDATION", { fieldErrors: mapped.fields, context: { ...context, db: msg, hint: resolved } });
  }
  if (code === "23505") {
    if (msg.includes("products_tenant_id_slug_key")) return new AppError("VALIDATION", { fieldErrors: { slug: ["Another product already uses this URL handle"] }, context });
    if (msg.includes("product_variants_sku_key")) {
      return new AppError("VALIDATION", {
        fieldErrors: { variants: ["One of these SKUs is already used by another product in this store. Change the duplicate SKU and try again."] },
        context,
      });
    }
    if (msg.includes("categories_tenant_id_slug_key")) return new AppError("VALIDATION", { fieldErrors: { slug: ["Another category already uses this URL handle"] }, context });
    if (msg.includes("collections_tenant_id_slug_key")) return new AppError("VALIDATION", { fieldErrors: { slug: ["Another collection already uses this URL handle"] }, context });
    if (msg.includes("product_options")) return new AppError("VALIDATION", { fieldErrors: { options: ["Option names must be unique"] }, context });
    if (msg.includes("product_option_values")) return new AppError("VALIDATION", { fieldErrors: { options: ["Option values must be unique within each option"] }, context });
    return new AppError("VALIDATION", { fieldErrors: { _form: ["That value is already in use. Change it and try again."] }, context: { ...context, db: msg } });
  }
  if (code === "23503") {
    return new AppError("VALIDATION", { fieldErrors: { _form: ["A selected category or size chart no longer exists. Reload and pick again."] }, context: { ...context, db: msg } });
  }
  if (code === "23514") {
    if (/compare_at/i.test(msg)) {
      return new AppError("VALIDATION", { fieldErrors: { variants: ["MRP must be at least the selling price for every variant."] }, context: { ...context, db: msg } });
    }
    return new AppError("VALIDATION", {
      fieldErrors: { _form: ["A value did not meet a store rule. Check prices, options, and status, then try again."] },
      context: { ...context, db: msg },
    });
  }
  if (code === "22023") {
    if (/invalid quantity/i.test(msg)) {
      return new AppError("VALIDATION", { fieldErrors: { variants: ["Opening stock must be a whole number between 0 and 1,000,000."] }, context: { ...context, db: msg } });
    }
    return new AppError("VALIDATION", {
      fieldErrors: { _form: ["Something in this product isn't valid. Check options, variants, and stock, then try again."] },
      context: { ...context, db: msg },
    });
  }
  if (code === "P0002" && /variant not found/i.test(msg)) {
    return new AppError("VALIDATION", {
      fieldErrors: { variants: ["A variant was removed or no longer belongs to this product. Reload the page and try again."] },
      context: { ...context, db: msg },
    });
  }
  if (hintIsInsufficient(error)) {
    return new AppError("CONFLICT", { fieldErrors: { _form: ["Not enough stock for that adjustment."] }, context });
  }
  // Prefer catalog fieldErrors over a bare VALIDATION/INTERNAL with no actionable text.
  const fallback = mapDbError(error, context);
  if (fallback.code === "INTERNAL" || (fallback.code === "VALIDATION" && !fallback.fieldErrors)) {
    return new AppError(fallback.code === "INTERNAL" ? "INTERNAL" : "VALIDATION", {
      fieldErrors: {
        _form: [
          fallback.code === "INTERNAL"
            ? "Could not save this product. Reload and try again. If it keeps failing, check variant SKUs and options."
            : "Some product fields need attention. Check the Variants and Options cards for details.",
        ],
      },
      context: fallback.context,
    });
  }
  return fallback;
}

function hintIsInsufficient(error: PgError): boolean {
  return (error?.hint ?? "") === "INSUFFICIENT_STOCK" || /INSUFFICIENT_STOCK/.test(error?.message ?? "");
}
