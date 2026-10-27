import { describe, expect, it } from "vitest";
import { categorySizeChartId, resolveSizeChartId, sizeChartHidden } from "@/features/catalog/size-chart";
import { productInputSchema, sizeChartSchema, toSaveProductPayload } from "@/features/catalog/schemas";
import { dbToDraft, type DbProduct } from "@/features/catalog/draft";
import { emptyProductDraft } from "@/features/catalog/types";

const WOMEN = "31000000-0000-4000-a000-000000000001";
const KURTAS = "31000000-0000-4000-a000-000000000002";
const STRAIGHT = "31000000-0000-4000-a000-000000000003";
const JEWELLERY = "31000000-0000-4000-a000-000000000004";
const CHART_A = "32000000-0000-4000-a000-000000000001";
const CHART_B = "32000000-0000-4000-a000-000000000002";

const categories = [
  { id: WOMEN, parentId: null, sizeChartId: CHART_A },
  { id: KURTAS, parentId: WOMEN, sizeChartId: null },
  { id: STRAIGHT, parentId: KURTAS, sizeChartId: CHART_B },
  { id: JEWELLERY, parentId: null, sizeChartId: null },
];

describe("size chart resolution", () => {
  it("uses the category's chart, inheriting from the nearest parent", () => {
    expect(categorySizeChartId(categories, STRAIGHT)).toBe(CHART_B);
    expect(categorySizeChartId(categories, KURTAS)).toBe(CHART_A);
    expect(categorySizeChartId(categories, JEWELLERY)).toBeNull();
    expect(categorySizeChartId(categories, null)).toBeNull();
    expect(categorySizeChartId(categories, "31000000-0000-4000-a000-0000000000ff")).toBeNull();
  });

  it("is safe with a parent cycle", () => {
    const loop = [
      { id: WOMEN, parentId: KURTAS, sizeChartId: null },
      { id: KURTAS, parentId: WOMEN, sizeChartId: null },
    ];
    expect(categorySizeChartId(loop, WOMEN)).toBeNull();
  });

  it("product chart → category chart → none, and a product can opt out", () => {
    expect(resolveSizeChartId({ sizeChartId: CHART_B, hideSizeChart: false, categoryId: WOMEN }, categories)).toBe(CHART_B);
    expect(resolveSizeChartId({ sizeChartId: null, hideSizeChart: false, categoryId: KURTAS }, categories)).toBe(CHART_A);
    expect(resolveSizeChartId({ sizeChartId: null, hideSizeChart: false, categoryId: JEWELLERY }, categories)).toBeNull();
    expect(resolveSizeChartId({ sizeChartId: null, hideSizeChart: false, categoryId: null }, categories)).toBeNull();
    expect(resolveSizeChartId({ sizeChartId: null, hideSizeChart: true, categoryId: KURTAS }, categories)).toBeNull();
  });

  it("reads the opt-out flag from product attributes", () => {
    expect(sizeChartHidden({ _size_chart: "none" })).toBe(true);
    expect(sizeChartHidden({ _size_chart: "other" })).toBe(false);
    expect(sizeChartHidden(null)).toBe(false);
    expect(sizeChartHidden(["_size_chart"])).toBe(false);
  });
});

describe("product size chart choice round trip", () => {
  const draft = () => ({
    ...emptyProductDraft(),
    title: "Ring",
    slug: "ring",
    variants: [{ ...emptyProductDraft().variants[0]!, price: "999" }],
  });
  const dbRow = (payload: ReturnType<typeof toSaveProductPayload>): DbProduct => ({
    id: "33000000-0000-4000-a000-000000000001",
    updated_at: "2026-10-27T00:00:00Z",
    title: "Ring",
    slug: "ring",
    description: null,
    short_description: null,
    product_type: "other",
    brand: null,
    category_id: null,
    size_chart_id: payload.product.size_chart_id,
    status: "draft",
    featured: false,
    tags: [],
    attributes: payload.product.attributes,
    care_instructions: null,
    shipping_info: null,
    return_info: null,
    hsn_code: null,
    seo: {},
  });

  it("stores 'no size chart' as an attribute flag and clears the chart id", () => {
    const p = productInputSchema.parse({ ...draft(), sizeChartId: CHART_A, hideSizeChart: true });
    const payload = toSaveProductPayload(p, { allowInitialStock: false });
    expect(payload.product.size_chart_id).toBeNull();
    expect(payload.product.attributes).toEqual({ _size_chart: "none" });
    expect(dbToDraft(dbRow(payload), [], [], []).hideSizeChart).toBe(true);
  });

  it("keeps a specific chart and defaults to the category chart", () => {
    const own = toSaveProductPayload(productInputSchema.parse({ ...draft(), sizeChartId: CHART_A }), { allowInitialStock: false });
    expect(own.product.size_chart_id).toBe(CHART_A);
    expect(own.product.attributes).toEqual({});
    const d = dbToDraft(dbRow(own), [], [], []);
    expect(d).toMatchObject({ sizeChartId: CHART_A, hideSizeChart: false });
    expect(toSaveProductPayload(productInputSchema.parse(draft()), { allowInitialStock: false }).product.size_chart_id).toBeNull();
  });
});

describe("sizeChartSchema categories", () => {
  const base = { name: "Kurta sizes", unit: "in", chart: JSON.stringify({ columns: ["Size", "Bust"], rows: [["S", "34"]], note: "" }) };
  it("parses the category list and leaves it undefined when not sent", () => {
    expect(sizeChartSchema.parse({ ...base, categoryIds: JSON.stringify([WOMEN, KURTAS]) }).categoryIds).toEqual([WOMEN, KURTAS]);
    expect(sizeChartSchema.parse({ ...base, categoryIds: "[]" }).categoryIds).toEqual([]);
    expect(sizeChartSchema.parse(base).categoryIds).toBeUndefined();
    expect(sizeChartSchema.safeParse({ ...base, categoryIds: JSON.stringify(["not-a-uuid"]) }).success).toBe(false);
  });
});
