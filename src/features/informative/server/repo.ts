import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import { AppError } from "@/lib/errors";
import type { TenantPermission } from "@/lib/permissions/matrix";
import type { Json, TablesInsert, TablesUpdate } from "@/lib/supabase/database.types";
import {
  paiseToDb,
  toEnquiry,
  toFaq,
  toGalleryItem,
  toPage,
  toService,
  toSite,
  toTeamMember,
  toTestimonial,
  type InfoEnquiry,
  type InfoFaq,
  type InfoGalleryItem,
  type InfoPage,
  type InfoService,
  type InfoSite,
  type InfoTeamMember,
  type InfoTestimonial,
} from "../model";
import { uniqueSlug } from "../slug";
import type { PageSection } from "../sections";
import type {
  AppearanceInput,
  BusinessInfoInput,
  EnquiryFilter,
  EnquiryStatus,
  FaqInput,
  GalleryItemInput,
  OpeningHours,
  PageInput,
  SeoInput,
  ServiceInput,
  TeamMemberInput,
  TestimonialInput,
} from "../schemas";

/**
 * Informative Website data services (M2). Every function takes the member context resolved by
 * requireInformativeTenant() — the tenant id NEVER comes from input — checks the permission key,
 * and runs on the member's own session so RLS enforces the same rules in the database.
 * Inputs are already parsed by the zod schemas in ../schemas.ts. Removal is a soft delete.
 */
export type RepoCtx = { tenantId: string; permissions: ReadonlySet<TenantPermission> };

function need(ctx: RepoCtx, permission: TenantPermission): void {
  if (!ctx.permissions.has(permission)) throw new AppError("FORBIDDEN", { context: { permission } });
}
const db = () => createSupabaseServerClient();
const now = () => new Date().toISOString();

// ---- Site ------------------------------------------------------------------------------------

export async function getSite(ctx: RepoCtx): Promise<InfoSite | null> {
  need(ctx, "store.read");
  const { data, error } = await (await db()).from("info_sites").select("*").eq("tenant_id", ctx.tenantId).is("deleted_at", null).maybeSingle();
  if (error) throw mapDbError(error, { op: "info.getSite" });
  return data ? toSite(data) : null;
}

async function updateSite(ctx: RepoCtx, patch: TablesUpdate<"info_sites">, op: string): Promise<InfoSite> {
  const { data, error } = await (await db()).from("info_sites").update(patch).eq("tenant_id", ctx.tenantId).is("deleted_at", null).select("*").maybeSingle();
  if (error) throw mapDbError(error, { op });
  if (!data) throw new AppError("NOT_FOUND", { context: { op } });
  return toSite(data);
}

export async function updateBusinessInfo(ctx: RepoCtx, input: BusinessInfoInput): Promise<InfoSite> {
  need(ctx, "settings.write");
  const whatsapp = input.whatsappSameAsPhone ? input.phone : (input.whatsapp ?? null);
  return updateSite(
    ctx,
    {
      business_name: input.businessName,
      tagline: input.tagline ?? null,
      category: input.category,
      about: input.about ?? null,
      contact: { phone: input.phone, whatsapp, email: input.email, city: input.city, address: input.address ?? null, mapUrl: input.mapUrl ?? null },
    },
    "info.updateBusinessInfo",
  );
}

export async function updateHours(ctx: RepoCtx, hours: OpeningHours): Promise<InfoSite> {
  need(ctx, "settings.write");
  return updateSite(ctx, { hours: [...hours].sort((a, b) => a.day - b.day) }, "info.updateHours");
}

export async function updateSocialLinks(ctx: RepoCtx, links: Record<string, string | undefined>): Promise<InfoSite> {
  need(ctx, "settings.write");
  const clean = Object.fromEntries(Object.entries(links).filter((e): e is [string, string] => typeof e[1] === "string" && e[1].length > 0));
  return updateSite(ctx, { social_links: clean }, "info.updateSocialLinks");
}

/** Switching theme only changes presentation fields: content tables are untouched (plan: content kept). */
export async function updateAppearance(ctx: RepoCtx, input: AppearanceInput): Promise<InfoSite> {
  need(ctx, "theme.edit");
  return updateSite(
    ctx,
    {
      theme_id: input.themeId,
      primary_color: input.primaryColor ?? null,
      secondary_color: input.secondaryColor ?? null,
      font_pair: input.fontPair ?? null,
      logo_path: input.logoPath ?? null,
      favicon_path: input.faviconPath ?? null,
      hero_image_path: input.heroImagePath ?? null,
    },
    "info.updateAppearance",
  );
}

export async function updateSeo(ctx: RepoCtx, input: SeoInput): Promise<InfoSite> {
  need(ctx, "settings.write");
  return updateSite(ctx, { seo: { title: input.title ?? null, description: input.description ?? null, ogImagePath: input.ogImagePath ?? null } }, "info.updateSeo");
}

export async function updateSiteOptions(ctx: RepoCtx, input: { enquirySuccessMessage?: string; showPreferredDateTime?: boolean; privacyText?: string }): Promise<InfoSite> {
  need(ctx, "settings.write");
  return updateSite(
    ctx,
    { options: { enquirySuccessMessage: input.enquirySuccessMessage ?? null, showPreferredDateTime: input.showPreferredDateTime ?? null, privacyText: input.privacyText ?? null } },
    "info.updateSiteOptions",
  );
}

/** Publish / unpublish (theme.publish). Publishing stamps published_at. */
export async function setSiteStatus(ctx: RepoCtx, status: "DRAFT" | "PUBLISHED"): Promise<InfoSite> {
  need(ctx, "theme.publish");
  return updateSite(ctx, status === "PUBLISHED" ? { status, published_at: now() } : { status }, "info.setSiteStatus");
}

export type NotificationSettings = { notifyEmail: string | null; notifyEmailEnabled: boolean; notifyWhatsappEnabled: boolean };

export async function getNotificationSettings(ctx: RepoCtx): Promise<NotificationSettings> {
  need(ctx, "settings.write");
  const { data, error } = await (await db()).from("info_site_private").select("*").eq("tenant_id", ctx.tenantId).maybeSingle();
  if (error) throw mapDbError(error, { op: "info.getNotificationSettings" });
  return { notifyEmail: data?.notify_email ?? null, notifyEmailEnabled: data?.notify_email_enabled ?? true, notifyWhatsappEnabled: data?.notify_whatsapp_enabled ?? false };
}

export async function updateNotificationSettings(ctx: RepoCtx, input: { notifyEmail?: string; notifyEmailEnabled: boolean; notifyWhatsappEnabled: boolean }): Promise<void> {
  need(ctx, "settings.write");
  const { error } = await (await db())
    .from("info_site_private")
    .upsert({ tenant_id: ctx.tenantId, notify_email: input.notifyEmail ?? null, notify_email_enabled: input.notifyEmailEnabled, notify_whatsapp_enabled: input.notifyWhatsappEnabled }, { onConflict: "tenant_id" });
  if (error) throw mapDbError(error, { op: "info.updateNotificationSettings" });
}

// ---- Shared content helpers ------------------------------------------------------------------

export const CONTENT_TABLES = {
  services: "info_services",
  pages: "info_pages",
  gallery: "info_gallery_items",
  team: "info_team_members",
  testimonials: "info_testimonials",
  faqs: "info_faqs",
} as const;
export type ContentKind = keyof typeof CONTENT_TABLES;

/**
 * All six content tables share id / tenant_id / sort_order / deleted_at. The query builder is
 * typed as one of them; only those shared columns are touched through it.
 */
type Db = Awaited<ReturnType<typeof db>>;
function sharedTable(supabase: Db, kind: ContentKind) {
  return supabase.from(CONTENT_TABLES[kind] as "info_faqs");
}

async function nextSortOrder(kind: ContentKind, tenantId: string): Promise<number> {
  const { data, error } = await sharedTable(await db(), kind).select("sort_order").eq("tenant_id", tenantId).is("deleted_at", null).order("sort_order", { ascending: false }).limit(1);
  if (error) throw mapDbError(error, { op: "info.nextSortOrder", kind });
  return (data?.[0]?.sort_order ?? -1) + 1;
}

/** Soft delete (content.write). NOT_FOUND when the row is not this tenant's or is already deleted. */
export async function softDeleteContent(ctx: RepoCtx, kind: ContentKind, id: string): Promise<void> {
  need(ctx, "content.write");
  if (kind === "pages") {
    const page = await getPage(ctx, id);
    if (!page) throw new AppError("NOT_FOUND");
    if (page.type !== "CUSTOM") throw new AppError("VALIDATION", { fieldErrors: { _form: ["Home, About, Services and Contact can be hidden but not deleted."] } });
  }
  const { data, error } = await sharedTable(await db(), kind).update({ deleted_at: now() }).eq("tenant_id", ctx.tenantId).eq("id", id).is("deleted_at", null).select("id");
  if (error) throw mapDbError(error, { op: "info.softDelete", kind });
  if (!data?.length) throw new AppError("NOT_FOUND", { context: { kind } });
}

/** Reorder (content.write): ids must be exactly this tenant's live rows; sort_order = position. */
export async function reorderContent(ctx: RepoCtx, kind: ContentKind, ids: string[]): Promise<void> {
  need(ctx, "content.write");
  const { data, error } = await sharedTable(await db(), kind).select("id").eq("tenant_id", ctx.tenantId).is("deleted_at", null);
  if (error) throw mapDbError(error, { op: "info.reorder.read", kind });
  const live = new Set((data ?? []).map((r) => r.id));
  if (ids.length !== live.size || ids.some((id) => !live.has(id))) {
    throw new AppError("VALIDATION", { fieldErrors: { _form: ["The list changed. Reload and try again."] } });
  }
  const supabase = await db();
  // A fresh builder per row: builders from one from() share their URL, so filters would pile up.
  const results = await Promise.all(ids.map((id, i) => sharedTable(supabase, kind).update({ sort_order: i }).eq("tenant_id", ctx.tenantId).eq("id", id)));
  const failed = results.find((r) => r.error);
  if (failed?.error) throw mapDbError(failed.error, { op: "info.reorder.write", kind });
}

// ---- Services --------------------------------------------------------------------------------

export async function listServices(ctx: RepoCtx): Promise<InfoService[]> {
  need(ctx, "store.read");
  const { data, error } = await (await db()).from("info_services").select("*").eq("tenant_id", ctx.tenantId).is("deleted_at", null).order("sort_order").order("created_at");
  if (error) throw mapDbError(error, { op: "info.listServices" });
  return (data ?? []).map(toService);
}

export async function getService(ctx: RepoCtx, id: string): Promise<InfoService | null> {
  need(ctx, "store.read");
  const { data, error } = await (await db()).from("info_services").select("*").eq("tenant_id", ctx.tenantId).eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw mapDbError(error, { op: "info.getService" });
  return data ? toService(data) : null;
}

async function takenServiceSlugs(tenantId: string, exceptId?: string): Promise<Set<string>> {
  let q = (await db()).from("info_services").select("id, slug").eq("tenant_id", tenantId).is("deleted_at", null);
  if (exceptId) q = q.neq("id", exceptId);
  const { data, error } = await q;
  if (error) throw mapDbError(error, { op: "info.serviceSlugs" });
  return new Set((data ?? []).map((r) => r.slug));
}

function serviceRow(input: ServiceInput) {
  return {
    name: input.name,
    short_description: input.shortDescription ?? null,
    description: input.description ?? null,
    image_path: input.imagePath ?? null,
    price_type: input.priceType,
    price: paiseToDb(input.pricePaise ?? null),
    duration_minutes: input.durationMinutes ?? null,
    category: input.category ?? null,
    is_featured: input.isFeatured,
    is_active: input.isActive,
    seo: { title: input.seoTitle ?? null, description: input.seoDescription ?? null },
  } satisfies TablesUpdate<"info_services">;
}

const slugTaken = () => new AppError("VALIDATION", { fieldErrors: { slug: ["Another service already uses this address."] } });

export async function createService(ctx: RepoCtx, input: ServiceInput, opts: { isSample?: boolean } = {}): Promise<InfoService> {
  need(ctx, "content.write");
  const taken = await takenServiceSlugs(ctx.tenantId);
  if (input.slug && taken.has(input.slug)) throw slugTaken();
  const row: TablesInsert<"info_services"> = {
    ...serviceRow(input),
    tenant_id: ctx.tenantId,
    slug: input.slug ?? uniqueSlug(input.name, taken, "service"),
    is_sample: opts.isSample ?? false,
    sort_order: await nextSortOrder("services", ctx.tenantId),
  };
  const { data, error } = await (await db()).from("info_services").insert(row).select("*").single();
  if (error) throw error.code === "23505" ? slugTaken() : mapDbError(error, { op: "info.createService" });
  return toService(data);
}

/** Editing a sample service makes it the seller's own (the "Sample" label goes away). */
export async function updateService(ctx: RepoCtx, id: string, input: ServiceInput): Promise<InfoService> {
  need(ctx, "content.write");
  const patch: TablesUpdate<"info_services"> = { ...serviceRow(input), is_sample: false };
  if (input.slug) {
    if ((await takenServiceSlugs(ctx.tenantId, id)).has(input.slug)) throw slugTaken();
    patch.slug = input.slug;
  }
  const { data, error } = await (await db()).from("info_services").update(patch).eq("tenant_id", ctx.tenantId).eq("id", id).is("deleted_at", null).select("*").maybeSingle();
  if (error) throw error.code === "23505" ? slugTaken() : mapDbError(error, { op: "info.updateService" });
  if (!data) throw new AppError("NOT_FOUND");
  return toService(data);
}

export async function duplicateService(ctx: RepoCtx, id: string): Promise<InfoService> {
  need(ctx, "content.write");
  const src = await getService(ctx, id);
  if (!src) throw new AppError("NOT_FOUND");
  return createService(ctx, {
    name: `${src.name} (copy)`.slice(0, 120),
    shortDescription: src.shortDescription ?? undefined,
    description: src.description ?? undefined,
    imagePath: src.imagePath ?? undefined,
    priceType: src.priceType,
    pricePaise: src.pricePaise,
    durationMinutes: src.durationMinutes,
    category: src.category ?? undefined,
    isFeatured: false,
    isActive: false,
    seoTitle: undefined,
    seoDescription: undefined,
  });
}

/** Toggle active / featured without resending the whole form. */
export async function setServiceFlags(ctx: RepoCtx, id: string, flags: { isActive?: boolean; isFeatured?: boolean }): Promise<void> {
  need(ctx, "content.write");
  const patch: TablesUpdate<"info_services"> = {};
  if (flags.isActive !== undefined) patch.is_active = flags.isActive;
  if (flags.isFeatured !== undefined) patch.is_featured = flags.isFeatured;
  const { data, error } = await (await db()).from("info_services").update(patch).eq("tenant_id", ctx.tenantId).eq("id", id).is("deleted_at", null).select("id");
  if (error) throw mapDbError(error, { op: "info.setServiceFlags" });
  if (!data?.length) throw new AppError("NOT_FOUND");
}

// ---- Pages -----------------------------------------------------------------------------------

export async function listPages(ctx: RepoCtx): Promise<InfoPage[]> {
  need(ctx, "store.read");
  const { data, error } = await (await db()).from("info_pages").select("*").eq("tenant_id", ctx.tenantId).is("deleted_at", null).order("sort_order").order("created_at");
  if (error) throw mapDbError(error, { op: "info.listPages" });
  return (data ?? []).map(toPage);
}

export async function getPage(ctx: RepoCtx, id: string): Promise<InfoPage | null> {
  need(ctx, "store.read");
  const { data, error } = await (await db()).from("info_pages").select("*").eq("tenant_id", ctx.tenantId).eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw mapDbError(error, { op: "info.getPage" });
  return data ? toPage(data) : null;
}

const pageSlugTaken = () => new AppError("VALIDATION", { fieldErrors: { slug: ["Another page already uses this address."] } });

/** New CUSTOM page (system pages are created once by onboarding). */
export async function createCustomPage(ctx: RepoCtx, input: PageInput): Promise<InfoPage> {
  need(ctx, "content.write");
  const { data: rows, error: e1 } = await (await db()).from("info_pages").select("slug").eq("tenant_id", ctx.tenantId).is("deleted_at", null);
  if (e1) throw mapDbError(e1, { op: "info.pageSlugs" });
  const taken = new Set((rows ?? []).map((r) => r.slug));
  if (input.slug && taken.has(input.slug)) throw pageSlugTaken();
  const { data, error } = await (await db())
    .from("info_pages")
    .insert({
      tenant_id: ctx.tenantId,
      type: "CUSTOM",
      title: input.title,
      slug: input.slug ?? uniqueSlug(input.title, new Set([...taken, ...RESERVED_FOR_CUSTOM]), "page"),
      is_published: input.isPublished,
      seo: { title: input.seoTitle ?? null, description: input.seoDescription ?? null },
      sort_order: await nextSortOrder("pages", ctx.tenantId),
    })
    .select("*")
    .single();
  if (error) throw error.code === "23505" ? pageSlugTaken() : mapDbError(error, { op: "info.createCustomPage" });
  return toPage(data);
}
const RESERVED_FOR_CUSTOM = ["home", "about", "services", "gallery", "contact"];

/** Title / publish / SEO. System pages keep their fixed address. */
export async function updatePage(ctx: RepoCtx, id: string, input: PageInput): Promise<InfoPage> {
  need(ctx, "content.write");
  const current = await getPage(ctx, id);
  if (!current) throw new AppError("NOT_FOUND");
  const patch: TablesUpdate<"info_pages"> = {
    title: input.title,
    is_published: input.isPublished,
    seo: { title: input.seoTitle ?? null, description: input.seoDescription ?? null },
  };
  if (current.type === "CUSTOM" && input.slug && input.slug !== current.slug) patch.slug = input.slug;
  const { data, error } = await (await db()).from("info_pages").update(patch).eq("tenant_id", ctx.tenantId).eq("id", id).is("deleted_at", null).select("*").maybeSingle();
  if (error) throw error.code === "23505" ? pageSlugTaken() : mapDbError(error, { op: "info.updatePage" });
  if (!data) throw new AppError("NOT_FOUND");
  return toPage(data);
}

/** Section editor save (show/hide, reorder, edit props). Sections are validated by the caller's schema. */
export async function updatePageSections(ctx: RepoCtx, id: string, sections: PageSection[]): Promise<InfoPage> {
  need(ctx, "content.write");
  const ordered = sections.map((s, i) => ({ ...s, order: i }));
  const { data, error } = await (await db()).from("info_pages").update({ sections: ordered as unknown as Json }).eq("tenant_id", ctx.tenantId).eq("id", id).is("deleted_at", null).select("*").maybeSingle();
  if (error) throw mapDbError(error, { op: "info.updatePageSections" });
  if (!data) throw new AppError("NOT_FOUND");
  return toPage(data);
}

// ---- Gallery / team / testimonials / FAQs ---------------------------------------------------

export async function listGallery(ctx: RepoCtx): Promise<InfoGalleryItem[]> {
  need(ctx, "store.read");
  const { data, error } = await (await db()).from("info_gallery_items").select("*").eq("tenant_id", ctx.tenantId).is("deleted_at", null).order("sort_order").order("created_at");
  if (error) throw mapDbError(error, { op: "info.listGallery" });
  return (data ?? []).map(toGalleryItem);
}

/** Multi-upload: one row per image, appended in order. */
export async function addGalleryItems(ctx: RepoCtx, items: GalleryItemInput[]): Promise<InfoGalleryItem[]> {
  need(ctx, "content.write");
  if (!items.length) return [];
  const start = await nextSortOrder("gallery", ctx.tenantId);
  const rows = items.map((it, i) => ({ tenant_id: ctx.tenantId, image_path: it.imagePath, caption: it.caption ?? null, alt: it.alt ?? null, album: it.album ?? null, sort_order: start + i }));
  const { data, error } = await (await db()).from("info_gallery_items").insert(rows).select("*");
  if (error) throw mapDbError(error, { op: "info.addGalleryItems" });
  return (data ?? []).map(toGalleryItem);
}

export async function updateGalleryItem(ctx: RepoCtx, id: string, input: Omit<GalleryItemInput, "imagePath">): Promise<InfoGalleryItem> {
  need(ctx, "content.write");
  const { data, error } = await (await db())
    .from("info_gallery_items")
    .update({ caption: input.caption ?? null, alt: input.alt ?? null, album: input.album ?? null })
    .eq("tenant_id", ctx.tenantId)
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();
  if (error) throw mapDbError(error, { op: "info.updateGalleryItem" });
  if (!data) throw new AppError("NOT_FOUND");
  return toGalleryItem(data);
}

export async function listTeam(ctx: RepoCtx): Promise<InfoTeamMember[]> {
  need(ctx, "store.read");
  const { data, error } = await (await db()).from("info_team_members").select("*").eq("tenant_id", ctx.tenantId).is("deleted_at", null).order("sort_order").order("created_at");
  if (error) throw mapDbError(error, { op: "info.listTeam" });
  return (data ?? []).map(toTeamMember);
}

const teamRow = (i: TeamMemberInput) => ({ name: i.name, role: i.role ?? null, bio: i.bio ?? null, photo_path: i.photoPath ?? null, is_visible: i.isVisible });

export async function createTeamMember(ctx: RepoCtx, input: TeamMemberInput): Promise<InfoTeamMember> {
  need(ctx, "content.write");
  const { data, error } = await (await db())
    .from("info_team_members")
    .insert({ ...teamRow(input), tenant_id: ctx.tenantId, sort_order: await nextSortOrder("team", ctx.tenantId) })
    .select("*")
    .single();
  if (error) throw mapDbError(error, { op: "info.createTeamMember" });
  return toTeamMember(data);
}

export async function updateTeamMember(ctx: RepoCtx, id: string, input: TeamMemberInput): Promise<InfoTeamMember> {
  need(ctx, "content.write");
  const { data, error } = await (await db()).from("info_team_members").update(teamRow(input)).eq("tenant_id", ctx.tenantId).eq("id", id).is("deleted_at", null).select("*").maybeSingle();
  if (error) throw mapDbError(error, { op: "info.updateTeamMember" });
  if (!data) throw new AppError("NOT_FOUND");
  return toTeamMember(data);
}

export async function listTestimonials(ctx: RepoCtx): Promise<InfoTestimonial[]> {
  need(ctx, "store.read");
  const { data, error } = await (await db()).from("info_testimonials").select("*").eq("tenant_id", ctx.tenantId).is("deleted_at", null).order("sort_order").order("created_at");
  if (error) throw mapDbError(error, { op: "info.listTestimonials" });
  return (data ?? []).map(toTestimonial);
}

const testimonialRow = (i: TestimonialInput) => ({ author_name: i.authorName, author_photo_path: i.authorPhotoPath ?? null, rating: i.rating, text: i.text, is_visible: i.isVisible });

export async function createTestimonial(ctx: RepoCtx, input: TestimonialInput): Promise<InfoTestimonial> {
  need(ctx, "content.write");
  const { data, error } = await (await db())
    .from("info_testimonials")
    .insert({ ...testimonialRow(input), tenant_id: ctx.tenantId, sort_order: await nextSortOrder("testimonials", ctx.tenantId) })
    .select("*")
    .single();
  if (error) throw mapDbError(error, { op: "info.createTestimonial" });
  return toTestimonial(data);
}

export async function updateTestimonial(ctx: RepoCtx, id: string, input: TestimonialInput): Promise<InfoTestimonial> {
  need(ctx, "content.write");
  const { data, error } = await (await db()).from("info_testimonials").update(testimonialRow(input)).eq("tenant_id", ctx.tenantId).eq("id", id).is("deleted_at", null).select("*").maybeSingle();
  if (error) throw mapDbError(error, { op: "info.updateTestimonial" });
  if (!data) throw new AppError("NOT_FOUND");
  return toTestimonial(data);
}

export async function listFaqs(ctx: RepoCtx): Promise<InfoFaq[]> {
  need(ctx, "store.read");
  const { data, error } = await (await db()).from("info_faqs").select("*").eq("tenant_id", ctx.tenantId).is("deleted_at", null).order("sort_order").order("created_at");
  if (error) throw mapDbError(error, { op: "info.listFaqs" });
  return (data ?? []).map(toFaq);
}

export async function createFaq(ctx: RepoCtx, input: FaqInput): Promise<InfoFaq> {
  need(ctx, "content.write");
  const { data, error } = await (await db())
    .from("info_faqs")
    .insert({ tenant_id: ctx.tenantId, question: input.question, answer: input.answer, is_visible: input.isVisible, sort_order: await nextSortOrder("faqs", ctx.tenantId) })
    .select("*")
    .single();
  if (error) throw mapDbError(error, { op: "info.createFaq" });
  return toFaq(data);
}

export async function updateFaq(ctx: RepoCtx, id: string, input: FaqInput): Promise<InfoFaq> {
  need(ctx, "content.write");
  const { data, error } = await (await db())
    .from("info_faqs")
    .update({ question: input.question, answer: input.answer, is_visible: input.isVisible })
    .eq("tenant_id", ctx.tenantId)
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();
  if (error) throw mapDbError(error, { op: "info.updateFaq" });
  if (!data) throw new AppError("NOT_FOUND");
  return toFaq(data);
}

// ---- Enquiries -------------------------------------------------------------------------------

export const ENQUIRIES_PAGE_SIZE = 50;

export async function listEnquiries(ctx: RepoCtx, filter: EnquiryFilter): Promise<{ rows: InfoEnquiry[]; total: number }> {
  need(ctx, "customers.read");
  let q = (await db()).from("info_enquiries").select("*", { count: "exact" }).eq("tenant_id", ctx.tenantId).is("deleted_at", null);
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.serviceId) q = q.eq("service_id", filter.serviceId);
  if (filter.from) q = q.gte("created_at", `${filter.from}T00:00:00+05:30`);
  if (filter.to) q = q.lte("created_at", `${filter.to}T23:59:59.999+05:30`);
  const fromRow = (filter.page - 1) * ENQUIRIES_PAGE_SIZE;
  const { data, error, count } = await q.order("created_at", { ascending: false }).range(fromRow, fromRow + ENQUIRIES_PAGE_SIZE - 1);
  if (error) throw mapDbError(error, { op: "info.listEnquiries" });
  return { rows: (data ?? []).map(toEnquiry), total: count ?? 0 };
}

export async function getEnquiry(ctx: RepoCtx, id: string): Promise<InfoEnquiry | null> {
  need(ctx, "customers.read");
  const { data, error } = await (await db()).from("info_enquiries").select("*").eq("tenant_id", ctx.tenantId).eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw mapDbError(error, { op: "info.getEnquiry" });
  return data ? toEnquiry(data) : null;
}

/** Status change and private notes only (column grants allow nothing else). */
export async function updateEnquiry(ctx: RepoCtx, id: string, input: { status?: EnquiryStatus; notes?: string }): Promise<InfoEnquiry> {
  need(ctx, "customers.write");
  const patch: TablesUpdate<"info_enquiries"> = {};
  if (input.status) patch.status = input.status;
  if (input.notes !== undefined) patch.notes = input.notes || null;
  if (!Object.keys(patch).length) throw new AppError("VALIDATION", { fieldErrors: { _form: ["Nothing to update."] } });
  const { data, error } = await (await db()).from("info_enquiries").update(patch).eq("tenant_id", ctx.tenantId).eq("id", id).is("deleted_at", null).select("*").maybeSingle();
  if (error) throw mapDbError(error, { op: "info.updateEnquiry" });
  if (!data) throw new AppError("NOT_FOUND");
  return toEnquiry(data);
}

export async function softDeleteEnquiry(ctx: RepoCtx, id: string): Promise<void> {
  need(ctx, "customers.write");
  const { data, error } = await (await db()).from("info_enquiries").update({ deleted_at: now() }).eq("tenant_id", ctx.tenantId).eq("id", id).is("deleted_at", null).select("id");
  if (error) throw mapDbError(error, { op: "info.softDeleteEnquiry" });
  if (!data?.length) throw new AppError("NOT_FOUND");
}

/** Counts per status (dashboard). */
export async function countEnquiriesByStatus(ctx: RepoCtx): Promise<Record<EnquiryStatus, number>> {
  need(ctx, "customers.read");
  const supabase = await db();
  const statuses: EnquiryStatus[] = ["NEW", "CONTACTED", "CONVERTED", "CLOSED"];
  const results = await Promise.all(
    statuses.map((s) => supabase.from("info_enquiries").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId).eq("status", s).is("deleted_at", null)),
  );
  const out = { NEW: 0, CONTACTED: 0, CONVERTED: 0, CLOSED: 0 } as Record<EnquiryStatus, number>;
  results.forEach((r, i) => {
    if (r.error) throw mapDbError(r.error, { op: "info.countEnquiries" });
    out[statuses[i]!] = r.count ?? 0;
  });
  return out;
}
