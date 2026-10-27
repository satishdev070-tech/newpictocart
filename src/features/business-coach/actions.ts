"use server";

/**
 * Business coach mutations. runAction + parseInput, marketing.write (credit RPC), tenant from membership.
 */
import { refresh } from "next/cache";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { parseInput } from "@/lib/validation/common";
import { assertPermission, requireTenant } from "@/lib/tenant/membership";
import { audit } from "@/lib/audit";
import { businessCoachInput, type BusinessCoachOutput } from "./schemas";
import { runBusinessCoach } from "./server/coach";

export type BusinessCoachActionData = BusinessCoachOutput & { provider: string; model: string; balance: number | null };

export async function generateBusinessCoachAction(input: { focus?: string } = {}): Promise<ActionResult<BusinessCoachActionData>> {
  const result = await runAction("businessCoach.generate", async () => {
    const ctx = await requireTenant();
    assertPermission(ctx, "marketing.write");
    const v = parseInput(businessCoachInput, input);
    const data = await runBusinessCoach(ctx, v);
    await audit({
      tenantId: ctx.tenantId,
      actorUserId: ctx.user.id,
      action: "business_coach.generated",
      entityType: "tenant",
      entityId: ctx.tenantId,
      metadata: { focus: v.focus, tipCount: data.tips.length, provider: data.provider },
    });
    return data;
  });
  if (result.ok) refresh();
  return result;
}
