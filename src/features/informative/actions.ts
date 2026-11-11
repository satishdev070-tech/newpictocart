"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { revalidateStorefront } from "@/lib/cache/storefront";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import { setActiveTenant } from "@/lib/tenant/active";
import { uploadTenantImage } from "@/lib/storage/upload";
import { assetUrl } from "@/lib/storage/assets";
import { requireInformativeTenant, type InformativeContext } from "./server/context";
import * as repo from "./server/repo";
import { findInformativeTheme } from "./themes/registry";
import {
  appearanceSchema,
  businessInfoSchema,
  faqSchema,
  galleryItemSchema,
  hoursSchema,
  notificationSettingsSchema,
  pageSchema,
  seoSchema,
  serviceSchema,
  siteOptionsSchema,
  socialLinksSchema,
  teamMemberSchema,
  testimonialSchema,
} from "./schemas";
import { sectionsSchema } from "./sections";

/**
 * Informative seller panel server actions (M5). Contract (ARCHITECTURE §6): validate → resolve the
 * tenant from the member's own membership (requireInformativeTenant; never from input; Online
 * Store tenants are refused by the guard) → permission (in ./server/repo) → execute → audit →
 * revalidate. Every write also drops the public site's cache.
 */

const PANEL = "/informative";
const idSchema = z.object({ id: z.uuid() });
const kindSchema = z.enum(["services", "pages", "gallery", "team", "testimonials", "faqs"]);

function done(ctx: InformativeContext, path?: string) {
  revalidateStorefront(ctx.tenantId);
  revalidatePath(path ?? PANEL, "layout");
}
const optionalId = (fd: FormData) => {
  const v = fd.get("id");
  return typeof v === "string" && v ? parseInput(idSchema, { id: v }).id : null;
};
const json = (fd: FormData, key: string): unknown => {
  try {
    return JSON.parse(String(fd.get(key) ?? "null"));
  } catch {
    throw new AppError("VALIDATION", { fieldErrors: { _form: ["Something in the form was malformed. Reload and try again."] } });
  }
};

// ---- Images ---------------------------------------------------------------------------------

/** Uploads one image under tenant/<id>/informative/ (member's RLS session, bytes sniffed). */
export async function uploadInformativeImageAction(fd: FormData): Promise<ActionResult<{ path: string; url: string | null }>> {
  return runAction("informative.uploadImage", async () => {
    const ctx = await requireInformativeTenant();
    if (!ctx.permissions.has("content.write") && !ctx.permissions.has("theme.edit")) throw new AppError("FORBIDDEN");
    const file = fd.get("file");
    if (!(file instanceof File)) throw new AppError("VALIDATION", { fieldErrors: { file: ["Choose an image to upload"] } });
    const { path } = await uploadTenantImage(ctx.tenantId, "informative", file);
    return { path, url: assetUrl(path) };
  });
}

// ---- Site profile ---------------------------------------------------------------------------

export async function saveBusinessInfoAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("informative.saveBusinessInfo", async () => {
    const input = parseInput(businessInfoSchema, formToObject(fd));
    const ctx = await requireInformativeTenant();
    await repo.updateBusinessInfo(ctx, input);
    done(ctx);
  });
}

export async function saveHoursAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("informative.saveHours", async () => {
    const hours = parseInput(hoursSchema, json(fd, "hours"));
    const ctx = await requireInformativeTenant();
    await repo.updateHours(ctx, hours);
    done(ctx);
  });
}

export async function saveSocialLinksAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("informative.saveSocialLinks", async () => {
    const links = parseInput(socialLinksSchema, formToObject(fd));
    const ctx = await requireInformativeTenant();
    await repo.updateSocialLinks(ctx, links);
    done(ctx);
  });
}

/** Switching theme keeps every piece of content (only presentation fields change). */
export async function saveAppearanceAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("informative.saveAppearance", async () => {
    const input = parseInput(appearanceSchema, formToObject(fd));
    if (!findInformativeTheme(input.themeId)) throw new AppError("VALIDATION", { fieldErrors: { themeId: ["Choose one of the designs"] } });
    const ctx = await requireInformativeTenant();
    const before = await repo.getSite(ctx);
    await repo.updateAppearance(ctx, input);
    if (before && before.themeId !== input.themeId) {
      await audit({ tenantId: ctx.tenantId, actorUserId: ctx.user.id, action: "informative.theme_changed", entityType: "info_site", entityId: ctx.tenantId, metadata: { from: before.themeId, to: input.themeId } });
    }
    done(ctx);
  });
}

export async function saveSeoAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("informative.saveSeo", async () => {
    const input = parseInput(seoSchema, formToObject(fd));
    const ctx = await requireInformativeTenant();
    await repo.updateSeo(ctx, input);
    done(ctx);
  });
}

export async function saveSiteOptionsAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("informative.saveSiteOptions", async () => {
    const input = parseInput(siteOptionsSchema, formToObject(fd));
    const ctx = await requireInformativeTenant();
    await repo.updateSiteOptions(ctx, input);
    done(ctx);
  });
}

export async function saveNotificationSettingsAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("informative.saveNotifications", async () => {
    const input = parseInput(notificationSettingsSchema, formToObject(fd));
    const ctx = await requireInformativeTenant();
    await repo.updateNotificationSettings(ctx, input);
    done(ctx);
  });
}

/** Publish / unpublish (theme.publish). Publishing also takes the profile out of "coming soon". */
export async function setSiteStatusAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("informative.setSiteStatus", async () => {
    const { status } = parseInput(z.object({ status: z.enum(["DRAFT", "PUBLISHED"]) }), formToObject(fd));
    const ctx = await requireInformativeTenant();
    await repo.setSiteStatus(ctx, status);
    const { error } = await (await createSupabaseServerClient())
      .from("stores")
      .update(status === "PUBLISHED" ? { launch_status: "live", launched_at: new Date().toISOString() } : { launch_status: "draft" })
      .eq("tenant_id", ctx.tenantId);
    if (error) throw mapDbError(error, { op: "informative.launch_status" });
    await audit({ tenantId: ctx.tenantId, actorUserId: ctx.user.id, action: status === "PUBLISHED" ? "informative.published" : "informative.unpublished", entityType: "info_site", entityId: ctx.tenantId });
    done(ctx);
  });
}

/** Delete site = the existing "close store" (owner only, typed confirmation, nothing hard-deleted). */
export async function closeSiteAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("informative.closeSite", async () => {
    const { confirmSlug } = parseInput(z.object({ confirmSlug: z.string().trim().toLowerCase().max(63) }), formToObject(fd));
    const ctx = await requireInformativeTenant();
    if (ctx.role !== "owner") throw new AppError("FORBIDDEN", { message: "Only the owner can delete this website." });
    const { error } = await (await createSupabaseServerClient()).rpc("close_own_store", { p_tenant: ctx.tenantId, p_confirm_slug: confirmSlug });
    if (error) {
      if (error.hint === "CONFIRM_MISMATCH") throw new AppError("VALIDATION", { fieldErrors: { confirmSlug: [`Type ${ctx.tenantSlug} exactly to confirm.`] } });
      if (error.hint === "HAS_CUSTOM_DOMAIN") throw new AppError("VALIDATION", { fieldErrors: { _form: ["Remove the custom domain first."] } });
      throw mapDbError(error, { tenantId: ctx.tenantId });
    }
    revalidateStorefront(ctx.tenantId);
    const next = ctx.memberships.find((m) => m.tenantId !== ctx.tenantId);
    if (next) await setActiveTenant(next.tenantId);
  });
  if (result.ok) redirect("/start");
  return result;
}

// ---- Shared content operations --------------------------------------------------------------

export async function deleteContentAction(fd: FormData): Promise<void> {
  const r = await runAction("informative.deleteContent", async () => {
    const { kind, id } = parseInput(z.object({ kind: kindSchema, id: z.uuid() }), formToObject(fd));
    const ctx = await requireInformativeTenant();
    await repo.softDeleteContent(ctx, kind, id);
    done(ctx);
  });
  if (!r.ok) throw new Error(r.error.fieldErrors?._form?.[0] ?? r.error.message);
}

async function liveIds(ctx: InformativeContext, kind: z.infer<typeof kindSchema>): Promise<string[]> {
  switch (kind) {
    case "services":
      return (await repo.listServices(ctx)).map((x) => x.id);
    case "pages":
      return (await repo.listPages(ctx)).map((x) => x.id);
    case "gallery":
      return (await repo.listGallery(ctx)).map((x) => x.id);
    case "team":
      return (await repo.listTeam(ctx)).map((x) => x.id);
    case "testimonials":
      return (await repo.listTestimonials(ctx)).map((x) => x.id);
    case "faqs":
      return (await repo.listFaqs(ctx)).map((x) => x.id);
  }
}

/** Move one row up or down (keyboard-accessible reordering). */
export async function moveContentAction(fd: FormData): Promise<void> {
  const r = await runAction("informative.moveContent", async () => {
    const { kind, id, dir } = parseInput(z.object({ kind: kindSchema, id: z.uuid(), dir: z.enum(["up", "down"]) }), formToObject(fd));
    const ctx = await requireInformativeTenant();
    const ids = await liveIds(ctx, kind);
    const i = ids.indexOf(id);
    const j = dir === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    await repo.reorderContent(ctx, kind, ids);
    done(ctx);
  });
  if (!r.ok) throw new Error(r.error.message);
}

// ---- Services -------------------------------------------------------------------------------

export async function saveServiceAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction("informative.saveService", async () => {
    const id = optionalId(fd);
    const input = parseInput(serviceSchema, formToObject(fd));
    const ctx = await requireInformativeTenant();
    const s = id ? await repo.updateService(ctx, id, input) : await repo.createService(ctx, input);
    done(ctx);
    return { id: s.id };
  });
}

export async function toggleServiceAction(fd: FormData): Promise<void> {
  const r = await runAction("informative.toggleService", async () => {
    const { id, field, value } = parseInput(z.object({ id: z.uuid(), field: z.enum(["isActive", "isFeatured"]), value: z.enum(["true", "false"]) }), formToObject(fd));
    const ctx = await requireInformativeTenant();
    await repo.setServiceFlags(ctx, id, { [field]: value === "true" });
    done(ctx);
  });
  if (!r.ok) throw new Error(r.error.message);
}

export async function duplicateServiceAction(fd: FormData): Promise<void> {
  const r = await runAction("informative.duplicateService", async () => {
    const { id } = parseInput(idSchema, formToObject(fd));
    const ctx = await requireInformativeTenant();
    await repo.duplicateService(ctx, id);
    done(ctx);
  });
  if (!r.ok) throw new Error(r.error.message);
}

// ---- Pages ----------------------------------------------------------------------------------

export async function savePageAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction("informative.savePage", async () => {
    const id = optionalId(fd);
    const input = parseInput(pageSchema, formToObject(fd));
    const ctx = await requireInformativeTenant();
    const p = id ? await repo.updatePage(ctx, id, input) : await repo.createCustomPage(ctx, input);
    done(ctx);
    return { id: p.id };
  });
}

export async function savePageSectionsAction(input: { pageId: string; sections: unknown }): Promise<ActionResult> {
  return runAction("informative.savePageSections", async () => {
    const { pageId } = parseInput(z.object({ pageId: z.uuid() }), { pageId: input.pageId });
    const sections = parseInput(sectionsSchema, input.sections);
    const ctx = await requireInformativeTenant();
    await repo.updatePageSections(ctx, pageId, sections);
    done(ctx);
  });
}

// ---- Gallery / team / testimonials / FAQs ---------------------------------------------------

export async function addGalleryItemsAction(input: { paths: string[] }): Promise<ActionResult<{ count: number }>> {
  return runAction("informative.addGalleryItems", async () => {
    const items = parseInput(z.array(galleryItemSchema).min(1).max(30), input.paths.map((imagePath) => ({ imagePath })));
    const ctx = await requireInformativeTenant();
    const rows = await repo.addGalleryItems(ctx, items);
    done(ctx);
    return { count: rows.length };
  });
}

export async function saveGalleryItemAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("informative.saveGalleryItem", async () => {
    const { id } = parseInput(idSchema, formToObject(fd));
    const input = parseInput(galleryItemSchema.omit({ imagePath: true }), formToObject(fd));
    const ctx = await requireInformativeTenant();
    await repo.updateGalleryItem(ctx, id, input);
    done(ctx);
  });
}

export async function saveTeamMemberAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction("informative.saveTeamMember", async () => {
    const id = optionalId(fd);
    const input = parseInput(teamMemberSchema, formToObject(fd));
    const ctx = await requireInformativeTenant();
    const m = id ? await repo.updateTeamMember(ctx, id, input) : await repo.createTeamMember(ctx, input);
    done(ctx);
    return { id: m.id };
  });
}

export async function saveTestimonialAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction("informative.saveTestimonial", async () => {
    const id = optionalId(fd);
    const input = parseInput(testimonialSchema, formToObject(fd));
    const ctx = await requireInformativeTenant();
    const t = id ? await repo.updateTestimonial(ctx, id, input) : await repo.createTestimonial(ctx, input);
    done(ctx);
    return { id: t.id };
  });
}

export async function saveFaqAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction("informative.saveFaq", async () => {
    const id = optionalId(fd);
    const input = parseInput(faqSchema, formToObject(fd));
    const ctx = await requireInformativeTenant();
    const f = id ? await repo.updateFaq(ctx, id, input) : await repo.createFaq(ctx, input);
    done(ctx);
    return { id: f.id };
  });
}
