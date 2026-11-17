"use server";

import { runAction, type ActionResult } from "@/lib/actions/result";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import type { PageSection, SectionType } from "../sections";
import { requireInformativeTenant, type InformativeContext } from "../server/context";
import { generateSection, rewriteSection } from "./server";
import { generateSectionInputSchema, rewriteSectionInputSchema } from "./schemas";

/**
 * Website editor "Add with AI" / "Rewrite with AI": validate → tenant from the member's own
 * membership (requireInformativeTenant) → content.write → burst rate limit → generate (credits,
 * daily limit, provider fallback and refunds in runSellerAiGeneration). Nothing is written: the
 * editor inserts the returned section and the seller saves the page.
 *
 * User-facing failures arrive in error.fieldErrors._form: no credits left, AI not set up, the AI
 * service failing or returning an unusable answer, limits, a page that no longer exists.
 */

async function editor(): Promise<InformativeContext> {
  const ctx = await requireInformativeTenant();
  if (!ctx.permissions.has("content.write")) throw new AppError("FORBIDDEN", { context: { permission: "content.write" } });
  try {
    await rateLimit("informative-editor-ai:burst", ctx.tenantId, 12, 60);
  } catch (err) {
    if (err instanceof AppError && err.code === "RATE_LIMITED") throw new AppError("RATE_LIMITED", { fieldErrors: { _form: ["That's a lot of AI requests in a minute. Wait a moment and try again."] } });
    throw err;
  }
  return ctx;
}

export async function generateSectionAction(input: { pageId: string; type?: SectionType; instruction: string; locale?: string }): Promise<ActionResult<{ section: PageSection }>> {
  return runAction("informative.editor.ai.generate", async () => {
    const parsed = parseInput(generateSectionInputSchema, input);
    const ctx = await editor();
    return generateSection(ctx, parsed);
  });
}

export async function rewriteSectionAction(input: { pageId: string; section: PageSection; instruction?: string; locale?: string }): Promise<ActionResult<{ section: PageSection }>> {
  return runAction("informative.editor.ai.rewrite", async () => {
    const parsed = parseInput(rewriteSectionInputSchema, input);
    const ctx = await editor();
    return rewriteSection(ctx, parsed);
  });
}
