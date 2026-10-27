"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { assertPermission, requireTenant } from "@/lib/tenant/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import { audit } from "@/lib/audit";

const schema = z.object({
  id: z.uuid(),
  tags: z.preprocess((v) => (typeof v === "string" ? v : ""), z.string()).transform((s) => [...new Set(s.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 30)),
  note: z.string().trim().max(2000).optional(),
  status: z.enum(["active", "blocked"]),
});

export async function updateCustomerAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  let id = "";
  const result = await runAction("customers.update", async () => {
    const ctx = await requireTenant();
    assertPermission(ctx, "customers.write");
    const v = parseInput(schema, formToObject(fd));
    id = v.id;
    const { error } = await (await createSupabaseServerClient()).from("customers").update({ tags: v.tags, note: v.note ?? null, status: v.status }).eq("id", v.id).eq("tenant_id", ctx.tenantId);
    if (error) throw mapDbError(error);
    await audit({ tenantId: ctx.tenantId, actorUserId: ctx.user.id, action: "customer.updated", entityType: "customer", entityId: v.id, metadata: { status: v.status } });
  });
  // Revalidate the list too (not just refresh this page): the client router otherwise keeps the
  // Customers list it already rendered, so "Blocked" only showed after leaving and coming back.
  if (result.ok) {
    revalidatePath("/dashboard/customers");
    revalidatePath(`/dashboard/customers/${id}`);
  }
  return result;
}
