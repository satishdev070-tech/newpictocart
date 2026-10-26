"use server";

import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { getRequestHost } from "@/lib/tenant/resolve";
import { requireStoreTenant } from "@/features/cart/context";
import { PREVIEW_COOKIE } from "@/features/theme/preview";
import { verifyPreviewToken } from "@/features/theme/server/preview";
import { MAX_CONFIG_BYTES, resolveThemeConfig } from "@/features/theme/schema/config";
import { getRenderContext, loadThemeMenus } from "@/features/theme/render/load";
import { SlotSections } from "@/features/theme/render/slot";
import { themeCss } from "@/features/theme/tokens-style";
import { slotList, slotSections, SLOT_KEY_RE } from "./slots";
import { PREVIEW_TOKEN_RE } from "./protocol";

const renderSchema = z.object({
  config: z.string().min(2).max(MAX_CONFIG_BYTES * 2),
  slots: z.array(z.string().regex(SLOT_KEY_RE)).max(12),
  /** Preview token sent by the builder with each edit (the cookie is only a fallback). */
  token: z.string().regex(PREVIEW_TOKEN_RE).optional(),
});

export type CanvasRender = { slots: Record<string, ReactNode>; css: string };

/**
 * Site builder canvas: renders the given slots of an UNSAVED theme for the framed storefront.
 * Runs on the store host. Tenant = verified host; authorised by the signed, tenant-bound preview
 * token (minted only for theme.edit members, see refreshPreviewUrlAction), sent by the builder with
 * each edit, or the preview cookie when no token is sent. The token in the body keeps working where
 * browsers block or partition third-party cookies, and the builder renews it. Nothing is stored:
 * the config is validated with the render-time parser and rendered once.
 */
export async function renderCanvasAction(input: { config: string; slots: string[]; token?: string }): Promise<ActionResult<CanvasRender>> {
  return runAction("theme.builderCanvas", async () => {
    const { config: raw, slots, token: sent } = parseInput(renderSchema, input);
    const tenant = await requireStoreTenant();
    const token = sent ?? (await cookies()).get(PREVIEW_COOKIE)?.value;
    if (!verifyPreviewToken(token, tenant.tenantId)) throw new AppError("FORBIDDEN");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new AppError("VALIDATION");
    }
    const { config } = resolveThemeConfig(parsed);
    const host = (await getRequestHost())!;
    const base = await getRenderContext(host);
    const ctx = { ...base, sf: { ...base.sf, theme: config }, menus: await loadThemeMenus(tenant.tenantId, config) };
    const out: Record<string, ReactNode> = {};
    for (const slot of slots) {
      const sections = slotSections(config, slot);
      // Handle slots (an unsaved page) and the home slot showing the homepage (config.homePageId)
      // report the list they edit, so canvas selections address it.
      const itemSlot = slot.startsWith("handle.") || slot === "templates.home" ? (slotList(config, slot) ?? slot) : slot;
      if (sections) out[slot] = <SlotSections sections={sections} ctx={ctx} slot={itemSlot} />;
    }
    return { slots: out, css: themeCss(config.tokens) };
  });
}
