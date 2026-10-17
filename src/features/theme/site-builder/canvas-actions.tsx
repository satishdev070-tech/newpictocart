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
import { SectionList } from "@/features/theme/render/sections";
import { themeCss } from "@/features/theme/tokens-style";
import { slotSections, SLOT_KEY_RE } from "./slots";

const renderSchema = z.object({
  config: z.string().min(2).max(MAX_CONFIG_BYTES * 2),
  slots: z.array(z.string().regex(SLOT_KEY_RE)).max(12),
});

export type CanvasRender = { slots: Record<string, ReactNode>; css: string };

/**
 * Site builder canvas: renders the given slots of an UNSAVED theme for the framed storefront.
 * Runs on the store host. Tenant = verified host; authorised by the signed, tenant-bound preview
 * cookie (minted only for theme.edit members, see refreshPreviewUrlAction). Nothing is stored:
 * the config is validated with the render-time parser and rendered once.
 */
export async function renderCanvasAction(input: { config: string; slots: string[] }): Promise<ActionResult<CanvasRender>> {
  return runAction("theme.builderCanvas", async () => {
    const { config: raw, slots } = parseInput(renderSchema, input);
    const tenant = await requireStoreTenant();
    const token = (await cookies()).get(PREVIEW_COOKIE)?.value;
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
      if (sections) out[slot] = <SectionList sections={sections} ctx={ctx} slot={slot} />;
    }
    return { slots: out, css: themeCss(config.tokens) };
  });
}
