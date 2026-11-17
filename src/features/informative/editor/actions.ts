"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { revalidateStorefront } from "@/lib/cache/storefront";
import { assertInformativePermission, requireInformativeTenant } from "../server/context";
import { saveEditorPageSections } from "../server/editor-repo";
import { sectionsSchema } from "../sections";
import { compactSections, fieldProblems } from "./fields";

/**
 * Website editor server actions (ARCHITECTURE §6): validate → tenant from the member's own
 * membership (requireInformativeTenant; never from input) → permission → write → revalidate.
 */

const saveSchema = z.object({
  pageId: z.uuid(),
  sections: sectionsSchema,
  /** updated_at the editor loaded; a newer save by someone else is a CONFLICT. */
  expectedUpdatedAt: z.string().trim().min(10).max(64).optional(),
});

export async function saveEditorPageAction(input: { pageId: string; sections: unknown; expectedUpdatedAt?: string }): Promise<ActionResult<{ updatedAt: string }>> {
  return runAction("informative.editor.savePage", async () => {
    const v = parseInput(saveSchema, input);
    const sections = parseInput(sectionsSchema, compactSections(v.sections));
    const problems = fieldProblems(sections);
    if (Object.keys(problems).length) throw new AppError("VALIDATION", { fieldErrors: { _form: ["A button link isn't valid. Fix the highlighted link and save again."], ...Object.fromEntries(Object.entries(problems).map(([k, m]) => [k, [m]])) } });
    const ctx = await requireInformativeTenant();
    assertInformativePermission(ctx, "content.write");
    const updatedAt = await saveEditorPageSections(ctx, v.pageId, sections, v.expectedUpdatedAt ?? null);
    revalidateStorefront(ctx.tenantId);
    revalidatePath("/informative", "layout");
    return { updatedAt };
  });
}
