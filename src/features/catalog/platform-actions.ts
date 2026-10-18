"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { assertPlatformPermission, getPlatformContext } from "@/lib/platform/access";
import { INDUSTRY_SLUGS } from "@/features/stores/industries";
import { attributeTemplateSchema, productTypeKeySchema } from "./product-types";
import { resetPlatformProductType, savePlatformProductType, setPlatformProductTypeStatus } from "./server/product-types";

/** Super Admin → Product types. validate → platform.settings.manage → write (RLS-enforced) → audit. */

async function actor() {
  const ctx = await getPlatformContext();
  if (!ctx) throw new AppError("FORBIDDEN");
  assertPlatformPermission(ctx, "platform.settings.manage");
  return ctx;
}

const PATH = "/admin/product-types";

const typeInputSchema = z.object({
  key: productTypeKeySchema,
  label: z.string().trim().min(1, "Enter a name").max(60),
  plural: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : null), z.string().max(60).nullable()),
  industries: z.array(z.enum(INDUSTRY_SLUGS as [string, ...string[]])).max(40).default([]),
  template: attributeTemplateSchema,
  position: z.coerce.number().int().min(0).max(1_000_000).default(0),
  status: z.enum(["active", "disabled"]).default("active"),
});

export async function savePlatformProductTypeAction(input: unknown): Promise<ActionResult> {
  const result = await runAction("platform.productType.save", async () => {
    const v = parseInput(typeInputSchema, input);
    const ctx = await actor();
    await savePlatformProductType(ctx, v);
    await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: "product_type.saved", entityType: "product_type", entityId: v.key, metadata: { label: v.label, status: v.status, industries: v.industries } });
  });
  if (result.ok) revalidatePath(PATH);
  return result;
}

export async function setPlatformProductTypeStatusAction(input: { key: string; status: "active" | "disabled" }): Promise<ActionResult> {
  const result = await runAction("platform.productType.status", async () => {
    const v = parseInput(z.object({ key: productTypeKeySchema, status: z.enum(["active", "disabled"]) }), input);
    const ctx = await actor();
    await setPlatformProductTypeStatus(ctx, v.key, v.status);
    await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: v.status === "active" ? "product_type.enabled" : "product_type.disabled", entityType: "product_type", entityId: v.key });
  });
  if (result.ok) revalidatePath(PATH);
  return result;
}

export async function resetPlatformProductTypeAction(input: { key: string }): Promise<ActionResult> {
  const result = await runAction("platform.productType.reset", async () => {
    const v = parseInput(z.object({ key: productTypeKeySchema }), input);
    const ctx = await actor();
    await resetPlatformProductType(ctx, v.key);
    await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: "product_type.reset", entityType: "product_type", entityId: v.key });
  });
  if (result.ok) revalidatePath(PATH);
  return result;
}
