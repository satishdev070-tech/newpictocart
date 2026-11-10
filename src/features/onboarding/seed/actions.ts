"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { requireUser } from "@/lib/auth/session";
import { isIndustry } from "@/features/stores/industries";
import { ownerContext } from "@/features/onboarding/server";
import { seedReadyStore } from "./pipeline";
import type { SeedReadyStoreResult } from "./schemas";

const actionSchema = z.object({
  tenantId: z.uuid(),
  storeName: z.string().trim().min(2).max(120).optional(),
  industry: z.string().refine(isIndustry, "Choose a valid store category").optional(),
  subcategory: z.string().trim().min(1).max(80).optional().nullable(),
  niche: z.string().trim().min(1).max(300).optional().nullable(),
  brief: z.string().trim().max(4000).optional(),
  locale: z.string().trim().min(2).max(16).optional(),
  applyTheme: z.boolean().optional(),
  themeKey: z.string().trim().min(2).max(80).optional(),
  plan: z.unknown().optional(),
});

/**
 * Server action: owner-gated ready-store seed (theme + catalogue + content).
 * Prefer calling after create_tenant during voice onboarding.
 */
export async function seedReadyStoreAction(input: z.infer<typeof actionSchema>): Promise<ActionResult<SeedReadyStoreResult>> {
  return runAction("onboarding.seedReadyStore", async () => {
    const v = parseInput(actionSchema, input);
    const user = await requireUser("/onboarding");
    const ctx = await ownerContext(user, v.tenantId);
    if (!ctx) throw new AppError("FORBIDDEN");

    // Resolve store name / industry from the tenant when the caller omits them.
    let storeName = v.storeName;
    let industry = v.industry;
    if (!storeName || !industry) {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .from("stores")
        .select("name, store_categories(slug)")
        .eq("tenant_id", v.tenantId)
        .maybeSingle();
      if (error || !data) throw new AppError("NOT_FOUND");
      storeName ??= data.name;
      const cat = data.store_categories;
      const slug = Array.isArray(cat) ? cat[0]?.slug : cat?.slug;
      if (!industry && typeof slug === "string" && isIndustry(slug)) industry = slug;
    }
    if (!storeName || !industry) {
      throw new AppError("VALIDATION", { fieldErrors: { _form: ["Store name and category are required before seeding."] } });
    }

    return seedReadyStore(ctx, {
      tenantId: v.tenantId,
      storeName,
      industry,
      subcategory: v.subcategory,
      niche: v.niche,
      brief: v.brief,
      locale: v.locale,
      applyTheme: v.applyTheme ?? true,
      themeKey: v.themeKey,
      plan: v.plan,
    });
  });
}
