import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import { AppError } from "@/lib/errors";
import { assertPlatformPermission, type PlatformContext } from "@/lib/platform/access";
import type { Json } from "@/lib/supabase/database.types";
import { getStoreIndustry } from "@/features/theme/marketplace/server";
import type { IndustrySlug } from "@/features/stores/industries";
import {
  DEFAULT_PRODUCT_TYPES,
  findType,
  mergeCatalogue,
  typeKeyFromLabel,
  type AttributeTemplate,
  type PlatformTypeRow,
  type ProductTypeDef,
  type StoreTypeRow,
} from "../product-types";

/**
 * Product-type catalogue reads/writes. Tables come from migration 3200; until it is applied
 * reads fall back to the code catalogue (`migrated: false`) and writes explain what's missing.
 */

type PgError = { code?: string; message?: string } | null;
const tableMissing = (e: PgError) => Boolean(e && (e.code === "42P01" || e.code === "PGRST205"));

export const MIGRATION_PENDING_MESSAGE = "This needs a database update that hasn't been applied yet (migration 20261018003200_product_types). Ask the platform team to apply it.";

async function platformRows(): Promise<{ rows: PlatformTypeRow[]; migrated: boolean }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("product_types").select("key, label, plural_label, industries, template, position, status");
  if (error) {
    if (tableMissing(error)) return { rows: [], migrated: false };
    throw mapDbError(error);
  }
  return { rows: data ?? [], migrated: true };
}

async function storeRows(tenantId: string): Promise<StoreTypeRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("tenant_product_types").select("key, label, template").eq("tenant_id", tenantId).order("label");
  if (error) {
    if (tableMissing(error)) return [];
    throw mapDbError(error);
  }
  return data ?? [];
}

export type TenantTypeCatalogue = { types: ProductTypeDef[]; industry: IndustrySlug | null; migrated: boolean };

/** Merged catalogue (defaults + platform + this store's types) and the store's industry. */
export async function getTenantTypeCatalogue(tenantId: string): Promise<TenantTypeCatalogue> {
  const [platform, store, industry] = await Promise.all([platformRows(), storeRows(tenantId), getStoreIndustry(tenantId)]);
  return { types: mergeCatalogue(platform.rows, store), industry, migrated: platform.migrated };
}

/** Creates (or returns the existing) store-only product type for a label. */
export async function createStoreProductType(tenantId: string, userId: string, input: { label: string; baseKey: string | null }): Promise<ProductTypeDef> {
  const { types } = await getTenantTypeCatalogue(tenantId);
  const sameLabel = types.find((t) => t.label.toLowerCase() === input.label.toLowerCase() && t.status === "active");
  if (sameLabel) return sameLabel;
  const base = input.baseKey ? findType(types, input.baseKey) : undefined;
  let key = typeKeyFromLabel(input.label);
  if (!key) throw new AppError("VALIDATION", { fieldErrors: { label: ["Use letters or numbers in the name"] } });
  // Never shadow a catalogue type with a different name: suffix the key.
  for (let n = 2; findType(types, key) && n < 50; n++) key = `${typeKeyFromLabel(input.label).slice(0, 36)}_${n}`;
  const template: AttributeTemplate = base?.template ?? { fashion: false, sizes: false, specs: ["Material", "Dimensions", "Weight"], care: "Care & usage" };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("tenant_product_types").insert({ tenant_id: tenantId, key, label: input.label, template: template as unknown as Json, created_by: userId });
  if (error) {
    if (tableMissing(error)) throw new AppError("VALIDATION", { fieldErrors: { label: [MIGRATION_PENDING_MESSAGE] } });
    if (error.code === "23505") throw new AppError("CONFLICT", { fieldErrors: { label: ["A product type with this name already exists"] } });
    throw mapDbError(error);
  }
  return { key, label: input.label, plural: input.label, industries: [], template, position: 100_000, status: "active", source: "store" };
}

// ---- Super Admin --------------------------------------------------------------------------

export type PlatformTypeListItem = ProductTypeDef & { overridden: boolean; inCode: boolean };

export async function listPlatformProductTypes(ctx: PlatformContext): Promise<{ types: PlatformTypeListItem[]; migrated: boolean }> {
  assertPlatformPermission(ctx, "platform.settings.manage");
  const { rows, migrated } = await platformRows();
  const overridden = new Set(rows.map((r) => r.key));
  const inCode = new Set(DEFAULT_PRODUCT_TYPES.map((t) => t.key));
  return { types: mergeCatalogue(rows).map((t) => ({ ...t, overridden: overridden.has(t.key), inCode: inCode.has(t.key) })), migrated };
}

export type PlatformTypeInput = { key: string; label: string; plural: string | null; industries: string[]; template: AttributeTemplate; position: number; status: "active" | "disabled" };

export async function savePlatformProductType(ctx: PlatformContext, input: PlatformTypeInput): Promise<void> {
  assertPlatformPermission(ctx, "platform.settings.manage");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("product_types").upsert(
    {
      key: input.key,
      label: input.label,
      plural_label: input.plural,
      industries: input.industries,
      template: input.template as unknown as Json,
      position: input.position,
      status: input.status,
      updated_by: ctx.user.id,
    },
    { onConflict: "key" },
  );
  if (error) {
    if (tableMissing(error)) throw new AppError("VALIDATION", { fieldErrors: { _form: [MIGRATION_PENDING_MESSAGE] } });
    throw mapDbError(error);
  }
}

export async function setPlatformProductTypeStatus(ctx: PlatformContext, key: string, status: "active" | "disabled"): Promise<void> {
  assertPlatformPermission(ctx, "platform.settings.manage");
  const { rows } = await platformRows();
  const current = mergeCatalogue(rows).find((t) => t.key === key);
  if (!current) throw new AppError("NOT_FOUND");
  await savePlatformProductType(ctx, { key, label: current.label, plural: current.plural, industries: current.industries, template: current.template, position: current.position, status });
}

/** Removes the Super Admin override: a code type goes back to its default, an added type is deleted. */
export async function resetPlatformProductType(ctx: PlatformContext, key: string): Promise<void> {
  assertPlatformPermission(ctx, "platform.settings.manage");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("product_types").delete().eq("key", key);
  if (error) {
    if (tableMissing(error)) throw new AppError("VALIDATION", { fieldErrors: { _form: [MIGRATION_PENDING_MESSAGE] } });
    throw mapDbError(error);
  }
}
