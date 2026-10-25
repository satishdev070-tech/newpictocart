import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import { isMissingSchemaError } from "@/features/platform/schemas";
import { bpsToPercentInput } from "../schemas";

/**
 * Value for the plan form's "GMV commission %" field: the plan's rate (or "0" for a new plan),
 * or null while plans.commission_bps does not exist yet (migration 3700), which hides the field.
 */
export async function planCommissionPercent(planId?: string): Promise<string | null> {
  const db = await createSupabaseServerClient();
  const query = db.from("plans").select("commission_bps");
  const { data, error } = planId ? await query.eq("id", planId).maybeSingle() : await query.limit(1).maybeSingle();
  if (error) {
    if (isMissingSchemaError(error)) return null;
    throw mapDbError(error);
  }
  return planId && data ? bpsToPercentInput(data.commission_bps) : "0";
}
