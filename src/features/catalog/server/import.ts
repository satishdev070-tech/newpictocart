import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";
import { groupByHandle, mergeImportIntoDraft, parseProductCsv, skippedImportItems, type ImportSkippedItem, type RowError } from "../csv";
import { productInputSchema, toSaveProductPayload } from "../schemas";
import { comboKey } from "../variants";
import type { ProductDraft } from "../types";
import type { DbProduct } from "../draft";
import { callSaveProduct, countProducts, loadDrafts, PRODUCT_COLUMNS, productLimit } from "./products";
import { catalogDbError } from "./db-errors";
import { ensureCategoriesBySlug } from "./categories";

export const MAX_IMPORT_BYTES = 900_000;

export type { ImportSkippedItem };

export type ImportPlanItem = {
  handle: string;
  title: string;
  action: "create" | "update";
  variants: number;
  stockUpdates: number;
  rows: number[];
  errors: string[];
};

export type ImportPlan = {
  fatal?: string;
  items: ImportPlanItem[];
  rowErrors: RowError[];
  creates: number;
  updates: number;
  /** products that will be skipped because of errors */
  invalid: number;
  /** Per-product skip reasons (same products as `invalid`). */
  skippedItems: ImportSkippedItem[];
  /** Category slugs auto-created so the import can resolve category handles. */
  categoriesCreated: string[];
  limit: number | null;
  current: number;
};

type PreparedItem = ImportPlanItem & { draft: ProductDraft; stock: { key: { sku: string | null; combo: string }; qty: number }[] };

/**
 * Parses and validates a product CSV against the tenant's current catalog. Nothing is
 * written except missing categories (auto-created so valid CSVs with new handles succeed).
 * Row errors carry 1-based spreadsheet row numbers.
 */
async function prepare(tenantId: string, text: string, opts: { createMissingCategories: boolean }): Promise<{ plan: ImportPlan; prepared: PreparedItem[] }> {
  const parsed = parseProductCsv(text);
  const empty: ImportPlan = { items: [], rowErrors: [], creates: 0, updates: 0, invalid: 0, skippedItems: [], categoriesCreated: [], limit: null, current: 0 };
  if (parsed.fatal) return { plan: { ...empty, fatal: parsed.fatal }, prepared: [] };

  const supabase = await createSupabaseServerClient();
  const groups = groupByHandle(parsed.rows);
  const handles = [...groups.keys()];
  const existing: DbProduct[] = [];
  for (let i = 0; i < handles.length; i += 200) {
    const { data, error } = await supabase.from("products").select(PRODUCT_COLUMNS).eq("tenant_id", tenantId).in("slug", handles.slice(i, i + 200));
    if (error) throw mapDbError(error);
    existing.push(...((data ?? []) as DbProduct[]));
  }
  const bySlug = new Map(existing.map((p) => [p.slug, p]));
  const drafts = await loadDrafts(supabase, tenantId, existing);

  const neededCats = [...new Set(parsed.rows.map((r) => r.category).filter((c): c is string => Boolean(c)))];
  let catBySlug = new Map<string, string>();
  let categoriesCreated: string[] = [];
  if (opts.createMissingCategories && neededCats.length) {
    const ensured = await ensureCategoriesBySlug(tenantId, neededCats);
    catBySlug = ensured.bySlug;
    categoriesCreated = ensured.created;
    if (categoriesCreated.length) {
      logger.info("catalog.import_categories_created", { tenantId, slugs: categoriesCreated });
    }
  } else {
    const { data: cats, error: cErr } = await supabase.from("categories").select("id, slug").eq("tenant_id", tenantId);
    if (cErr) throw mapDbError(cErr);
    catBySlug = new Map((cats ?? []).map((c) => [c.slug, c.id]));
  }

  const prepared: PreparedItem[] = [];
  for (const [handle, rows] of groups) {
    const current = bySlug.get(handle);
    const merged = mergeImportIntoDraft(current ? drafts.get(current.id)! : null, rows, (slug) => catBySlug.get(slug) ?? null);
    const errors = merged.errors.flatMap((e) => e.messages.map((m) => `Row ${e.row}: ${m}`));
    // apply opening stock to NEW variants through save_product; existing ones use set_inventory later
    const draft = merged.draft;
    const stockLater: PreparedItem["stock"] = [];
    for (const s of merged.stock) {
      const v = draft.variants.find((x) => (s.key.sku && x.sku.toUpperCase() === s.key.sku.toUpperCase()) || comboKey(x) === s.key.combo);
      if (v && !v.id) v.initialStock = String(s.qty);
      else stockLater.push(s);
    }
    if (!errors.length) {
      const check = productInputSchema.safeParse(draft);
      if (!check.success) {
        errors.push(...check.error.issues.slice(0, 5).map((iss) => `${friendlyPath(iss.path)}${iss.message}`));
      }
    }
    prepared.push({
      handle,
      title: draft.title || handle,
      action: current ? "update" : "create",
      variants: draft.variants.length,
      stockUpdates: merged.stock.length,
      rows: rows.map((r) => r.rowNumber),
      errors,
      draft,
      stock: stockLater,
    });
  }

  const [limit, currentCount] = await Promise.all([productLimit(tenantId), countProducts(tenantId)]);
  const validCreates = prepared.filter((p) => p.action === "create" && !p.errors.length);
  if (limit !== null && currentCount + validCreates.length > limit) {
    const room = Math.max(0, limit - currentCount);
    validCreates.slice(room).forEach((p) => p.errors.push(`Your plan allows ${limit} products; this one would exceed it.`));
  }

  const items = prepared.map(({ draft: _d, stock: _s, ...rest }) => rest);
  const skippedItems = skippedImportItems(items);
  return {
    prepared,
    plan: {
      items,
      rowErrors: parsed.errors,
      creates: items.filter((i) => i.action === "create" && !i.errors.length).length,
      updates: items.filter((i) => i.action === "update" && !i.errors.length).length,
      invalid: skippedItems.length,
      skippedItems,
      categoriesCreated,
      limit,
      current: currentCount,
    },
  };
}

function friendlyPath(path: PropertyKey[]): string {
  if (!path.length) return "";
  if (path[0] === "variants" && typeof path[1] === "number") return `Variant ${path[1] + 1}${path[2] ? ` ${String(path[2])}` : ""}: `;
  return `${path.map(String).join(".")}: `;
}

export async function previewImport(tenantId: string, text: string): Promise<ImportPlan> {
  // Preview also auto-creates missing categories so the plan matches what apply will do.
  return (await prepare(tenantId, text, { createMissingCategories: true })).plan;
}

export type ImportResult = {
  created: number;
  updated: number;
  stockSet: number;
  failed: { handle: string; message: string }[];
  skipped: number;
  skippedItems: ImportSkippedItem[];
  categoriesCreated: string[];
  rowErrors: RowError[];
  productIds: string[];
};

/**
 * Applies a CSV import. Every product is re-validated; products with errors are skipped.
 * Each product is saved atomically by public.save_product(); stock for existing variants is
 * then set with public.set_inventory() (needs inventory.write). Runs 4 products at a time.
 */
export async function applyImport(tenantId: string, text: string, opts: { canWriteInventory: boolean }): Promise<ImportResult> {
  const { plan, prepared } = await prepare(tenantId, text, { createMissingCategories: true });
  if (plan.fatal) throw new AppError("VALIDATION", { fieldErrors: { file: [plan.fatal] } });
  const supabase = await createSupabaseServerClient();
  const valid = prepared.filter((p) => !p.errors.length);
  type Ok = { ok: true; action: "create" | "update"; id: string; stockSet: number };
  type Fail = { ok: false; handle: string; message: string };
  const outcomes: Array<Ok | Fail> = [];

  const work = async (item: PreparedItem) => {
    try {
      const input = productInputSchema.parse(item.draft);
      const payload = toSaveProductPayload(input, { allowInitialStock: opts.canWriteInventory });
      const { data: id, error } = await callSaveProduct(supabase, tenantId, payload);
      if (error) throw catalogDbError(error, { handle: item.handle });
      let stockSet = 0;
      if (opts.canWriteInventory && item.stock.length) {
        const { data: vs, error: vErr } = await supabase.from("product_variants").select("id, sku, option1, option2, option3").eq("tenant_id", tenantId).eq("product_id", id);
        if (vErr) throw mapDbError(vErr);
        for (const s of item.stock) {
          const v = (vs ?? []).find((x) => (s.key.sku && x.sku?.toUpperCase() === s.key.sku.toUpperCase()) || comboKey(x) === s.key.combo);
          if (!v) continue;
          const { error: sErr } = await supabase.rpc("set_inventory", { p_variant: v.id, p_available: s.qty, p_note: "CSV import" });
          if (sErr) throw mapDbError(sErr);
          stockSet++;
        }
      }
      outcomes.push({ ok: true, action: item.action, id, stockSet });
    } catch (err) {
      const message = err instanceof AppError ? (err.fieldErrors ? Object.values(err.fieldErrors).flat()[0] : undefined) ?? err.publicMessage : "Could not be saved";
      if (!(err instanceof AppError)) logger.error("catalog.import_item_failed", { tenantId, handle: item.handle, error: err });
      outcomes.push({ ok: false, handle: item.handle, message });
    }
  };

  const queue = [...valid];
  await Promise.all(
    Array.from({ length: Math.min(4, queue.length) }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) await work(item);
    }),
  );

  // Tally once after workers finish so concurrent increments can't drift.
  let created = 0;
  let updated = 0;
  let stockSet = 0;
  const productIds: string[] = [];
  const failed: ImportResult["failed"] = [];
  for (const o of outcomes) {
    if (!o.ok) {
      failed.push({ handle: o.handle, message: o.message });
      continue;
    }
    productIds.push(o.id);
    stockSet += o.stockSet;
    if (o.action === "create") created++;
    else updated++;
  }
  return {
    created,
    updated,
    stockSet,
    failed,
    skipped: plan.skippedItems.length,
    skippedItems: plan.skippedItems,
    categoriesCreated: plan.categoriesCreated,
    rowErrors: plan.rowErrors,
    productIds,
  };
}
