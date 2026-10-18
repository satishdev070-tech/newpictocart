/** Catalog enumerations mirrored from the database CHECK constraints (0300 catalog). Pure module. */
import { DEFAULT_PRODUCT_TYPES, LEGACY_PRODUCT_TYPES, typePluralLabel } from "@/features/catalog/product-types";

/** @deprecated legacy fashion keys; product types are a catalogue now (features/catalog/product-types). */
export const PRODUCT_TYPES = LEGACY_PRODUCT_TYPES;
export type ProductType = string;

/** Plural labels for the default catalogue (listing filters, "Type" on the product page). */
export const PRODUCT_TYPE_LABELS: Record<string, string> = Object.fromEntries(DEFAULT_PRODUCT_TYPES.map((t) => [t.key, t.plural]));

export function productTypeLabel(t: string): string {
  return typePluralLabel(t);
}

export const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "best_selling", label: "Best selling" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
] as const;
export type ListingSort = (typeof SORT_OPTIONS)[number]["value"] | "relevance";
