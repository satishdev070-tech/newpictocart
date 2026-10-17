/**
 * Shapes of the demo-store seed data (scripts/demo). DEMO ONLY: brand names, people, addresses
 * and products are invented; prices are in RUPEES here and converted to integer paise by the
 * generator (src/lib/money.ts).
 */
import type { ProductType } from "../../../src/features/catalog/constants";
import type { IndustrySlug } from "../../../src/features/stores/industries";

/** A variant option. `scale` multiplies the base price per value (pack sizes, weights). Swatches as "Name|#hex". */
export type Opt = { name: string; values: string[]; scale?: number[] };

/** [title, price ₹, MRP ₹ (0 = no MRP), one-line description]. */
export type ProductRow = readonly [title: string, price: number, mrp: number, short: string];

export type Department = {
  slug: string;
  name: string;
  /** Category description, also reused in product descriptions. */
  blurb: string;
  /** Unsplash search terms for this department's product photos. */
  q: string;
  opt?: Opt;
  type?: ProductType;
  hsn?: string;
  /** Six products: store A sells the even ones, store B the odd ones. */
  products: readonly ProductRow[];
};

export type Brand = {
  slug: string;
  name: string;
  owner: string;
  tagline: string;
  /** Two or three sentences for the About page and brand story. */
  story: string;
  since: number;
  street: string;
  city: string;
  state: string;
  pin: string;
};

export type CategoryDef = {
  industry: IndustrySlug;
  /** Default HSN code (departments can override). */
  hsn: string;
  /** GST: [rate] or [lower rate, threshold ₹ per unit, upper rate]. */
  gst: readonly [number] | readonly [number, number, number];
  /** Default shipping weight per unit, grams. */
  weight: number;
  care: string;
  /** Short selling points shown in the trust band and product descriptions. */
  promises: readonly [string, string, string];
  /** Free-shipping threshold ₹. */
  freeOver: number;
  brands: readonly [Brand, Brand];
  departments: readonly Department[];
};
