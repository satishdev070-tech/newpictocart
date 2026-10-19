import "server-only";
import type { Json } from "@/lib/supabase/database.types";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";
import { toDecimalString } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import type { TenantContext } from "@/lib/tenant/membership";
import { productInputSchema, toSaveProductPayload } from "@/features/catalog/schemas";
import { callSaveProduct } from "@/features/catalog/server/products";
import { saveCategory } from "@/features/catalog/server/categories";
import { saveCollection } from "@/features/catalog/server/collections";
import { defaultTypeForIndustry } from "@/features/catalog/product-types";
import { getThemeEditorData } from "@/features/theme/server/queries";
import { parseThemeConfigStrict, assetsBelongToTenant, type ThemeConfig } from "@/features/theme/schema/config";
import { defaultSettings } from "@/features/theme/sections/definitions";
import type { SectionInstance, SectionType } from "@/features/theme/sections/types";
import type { IndustrySlug } from "@/features/stores/industries";
import type { ReadyStorePlan, SeedReadyStoreResult } from "./schemas";

type Ids = { categories: Record<string, string>; collections: Record<string, string>; products: string[] };

async function ensureCategories(tenantId: string, plan: ReadyStorePlan): Promise<{ ids: Record<string, string>; skipped: number }> {
  const supabase = await createSupabaseServerClient();
  const { data: existing, error } = await supabase.from("categories").select("id, slug").eq("tenant_id", tenantId);
  if (error) throw mapDbError(error);
  const bySlug = new Map((existing ?? []).map((r) => [r.slug, r.id]));
  let skipped = 0;
  for (const [i, c] of plan.categories.entries()) {
    const have = bySlug.get(c.slug);
    if (have) {
      skipped += 1;
      continue;
    }
    const r = await saveCategory(
      tenantId,
      {
        id: null,
        name: c.name,
        slug: c.slug,
        description: c.description,
        parentId: null,
        status: "active",
        position: i + 1,
        seoTitle: null,
        seoDescription: null,
        removeImage: false,
      },
      undefined,
    );
    bySlug.set(c.slug, r.id);
  }
  const ids: Record<string, string> = {};
  for (const c of plan.categories) {
    const id = bySlug.get(c.slug);
    if (id) ids[c.slug] = id;
  }
  return { ids, skipped };
}

async function ensureCollections(tenantId: string, plan: ReadyStorePlan): Promise<{ ids: Record<string, string>; skipped: number }> {
  const supabase = await createSupabaseServerClient();
  const { data: existing, error } = await supabase.from("collections").select("id, slug").eq("tenant_id", tenantId);
  if (error) throw mapDbError(error);
  const bySlug = new Map((existing ?? []).map((r) => [r.slug, r.id]));
  let skipped = 0;
  const list = plan.collections.length
    ? plan.collections
    : [
        { title: "Bestsellers", slug: "bestsellers", description: "Customer favourites." },
        { title: "New arrivals", slug: "new-arrivals", description: "Just landed." },
      ];
  for (const c of list) {
    if (bySlug.has(c.slug)) {
      skipped += 1;
      continue;
    }
    const r = await saveCollection(
      tenantId,
      {
        id: null,
        title: c.title,
        slug: c.slug,
        description: c.description,
        type: "manual",
        sortOrder: "manual",
        status: "active",
        seoTitle: null,
        seoDescription: null,
        rules: { match: "all", conditions: [] },
        productIds: [],
        removeImage: false,
      },
      undefined,
    );
    bySlug.set(c.slug, r.id);
  }
  const ids: Record<string, string> = {};
  for (const c of list) {
    const id = bySlug.get(c.slug);
    if (id) ids[c.slug] = id;
  }
  return { ids, skipped };
}

async function ensureProducts(
  tenantId: string,
  industry: IndustrySlug,
  plan: ReadyStorePlan,
  storeName: string,
  catIds: Record<string, string>,
): Promise<{ ids: string[]; skipped: number }> {
  const supabase = await createSupabaseServerClient();
  const { data: existing, error } = await supabase.from("products").select("id, slug").eq("tenant_id", tenantId);
  if (error) throw mapDbError(error);
  const bySlug = new Map((existing ?? []).map((r) => [r.slug, r.id]));
  let skipped = 0;
  const ids: string[] = [];
  const productType = defaultTypeForIndustry(industry);
  for (const [i, p] of plan.products.entries()) {
    const have = bySlug.get(p.slug);
    if (have) {
      skipped += 1;
      ids.push(have);
      continue;
    }
    const sku = `SEED-${String(i + 1).padStart(2, "0")}`;
    const input = productInputSchema.parse({
      title: p.title,
      slug: p.slug,
      description: p.description || p.shortDescription,
      shortDescription: p.shortDescription,
      productType,
      brand: storeName,
      categoryId: catIds[p.categorySlug] ?? null,
      status: "active",
      featured: p.featured || i < 2,
      tags: p.tags.length ? p.tags : i === 0 ? ["bestseller"] : [],
      attributes: { occasion: [], specs: [] },
      careInstructions: null,
      shippingInfo: null,
      returnInfo: null,
      hsnCode: p.hsnCode ?? null,
      seoTitle: p.seoTitle ?? `${p.title} | ${storeName}`.slice(0, 120),
      seoDescription: p.seoDescription ?? (p.shortDescription || p.description).slice(0, 320),
      options: [],
      variants: [
        {
          option1: null,
          option2: null,
          option3: null,
          sku,
          price: toDecimalString(p.pricePaise),
          compareAtPrice: p.compareAtPaise != null ? toDecimalString(p.compareAtPaise) : "",
          weightGrams: String(p.weightGrams),
          trackInventory: true,
          lowStockThreshold: "3",
          initialStock: "10",
          status: "active",
        },
      ],
    });
    const payload = toSaveProductPayload(input, { allowInitialStock: true });
    const { data: id, error: saveErr } = await callSaveProduct(supabase, tenantId, payload);
    if (saveErr || !id) {
      if (saveErr) throw mapDbError(saveErr);
      throw new AppError("INTERNAL", { context: { operation: "seed_save_product" } });
    }
    bySlug.set(p.slug, id);
    ids.push(id);
  }
  return { ids, skipped };
}

async function ensureMenu(tenantId: string, plan: ReadyStorePlan, catIds: Record<string, string>): Promise<{ menuId: string | null; skipped: boolean }> {
  const supabase = await createSupabaseServerClient();
  const { data: existing, error } = await supabase.from("menus").select("id, handle").eq("tenant_id", tenantId).eq("handle", "main").maybeSingle();
  if (error) throw mapDbError(error);
  if (existing) return { menuId: existing.id, skipped: true };

  const { data: menu, error: mErr } = await supabase.from("menus").insert({ tenant_id: tenantId, handle: "main", title: "Main menu" }).select("id").single();
  if (mErr) throw mapDbError(mErr);

  const shopChildren = plan.categories.map((c) => ({
    title: c.name,
    link_type: "category" as const,
    link_ref: catIds[c.slug] ?? null,
    url: null as string | null,
    highlight: false,
  }));

  const items = [
    {
      title: "Home",
      link_type: "home" as const,
      link_ref: null,
      url: null,
      highlight: false,
      children: [],
    },
    {
      title: "Shop",
      link_type: "url" as const,
      link_ref: null,
      url: "/collections",
      highlight: false,
      children: shopChildren,
    },
    {
      title: "About",
      link_type: "url" as const,
      link_ref: null,
      url: "/pages/about",
      highlight: false,
      children: [],
    },
    {
      title: "Blog",
      link_type: "url" as const,
      link_ref: null,
      url: "/blog",
      highlight: false,
      children: [],
    },
    {
      title: "Contact",
      link_type: "url" as const,
      link_ref: null,
      url: "/pages/contact",
      highlight: false,
      children: [],
    },
  ];

  const { error: rErr } = await supabase.rpc("replace_menu_items", { p_menu: menu.id, p_items: items as unknown as Json });
  if (rErr) throw mapDbError(rErr);
  return { menuId: menu.id, skipped: false };
}

async function ensureBlogs(tenantId: string, userId: string, plan: ReadyStorePlan): Promise<{ ids: string[]; skipped: number }> {
  const supabase = await createSupabaseServerClient();
  const { data: existing, error } = await supabase.from("blog_posts").select("id, slug").eq("tenant_id", tenantId);
  if (error) throw mapDbError(error);
  const bySlug = new Map((existing ?? []).map((r) => [r.slug, r.id]));
  let skipped = 0;
  const ids: string[] = [];
  const now = new Date().toISOString();
  for (const b of plan.blogs) {
    const have = bySlug.get(b.slug);
    if (have) {
      skipped += 1;
      ids.push(have);
      continue;
    }
    const body = b.paragraphs.map((text) => ({ type: "paragraph", text }));
    const { data, error: iErr } = await supabase
      .from("blog_posts")
      .insert({
        tenant_id: tenantId,
        title: b.title,
        slug: b.slug,
        status: "published",
        body: body as unknown as Json,
        excerpt: b.excerpt || b.paragraphs[0]!.slice(0, 280),
        author_name: null,
        tags: b.tags,
        seo: { title: b.seoTitle ?? b.title, description: b.seoDescription ?? b.excerpt },
        published_at: now,
        created_by: userId,
      })
      .select("id")
      .single();
    if (iErr) throw mapDbError(iErr);
    bySlug.set(b.slug, data.id);
    ids.push(data.id);
  }
  return { ids, skipped };
}

async function updateStoreSeo(tenantId: string, plan: ReadyStorePlan, storeName: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: current, error } = await supabase.from("stores").select("seo, tagline, description").eq("tenant_id", tenantId).maybeSingle();
  if (error) throw mapDbError(error);
  const prev = (current?.seo ?? {}) as Record<string, unknown>;
  const seo = {
    ...prev,
    title: plan.seo.title || storeName,
    description: plan.seo.description,
  };
  const { error: uErr } = await supabase
    .from("stores")
    .update({
      seo,
      tagline: plan.tagline.slice(0, 160),
      description: plan.story.slice(0, 2000),
    })
    .eq("tenant_id", tenantId);
  if (uErr) throw mapDbError(uErr);
}

function patchHomeSections(config: ThemeConfig, plan: ReadyStorePlan, ids: Ids): ThemeConfig {
  const home = config.templates.home.map((section) => patchSection(section, plan, ids));
  return { ...config, templates: { ...config.templates, home }, header: { ...config.header, menuHandle: config.header.menuHandle || "main" } };
}

function clip(value: string, max: number): string {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);
}

function patchSection(section: SectionInstance, plan: ReadyStorePlan, ids: Ids): SectionInstance {
  const type = section.type as SectionType;
  const settings = { ...(section.settings as Record<string, unknown>) };
  if (type === "Hero") {
    const defaults = defaultSettings("Hero") as { slides: Record<string, unknown>[] };
    const baseSlide = defaults.slides[0] ?? {};
    settings.slides = plan.hero.slides.slice(0, 5).map((s) => ({
      ...baseSlide,
      imagePath: typeof (baseSlide as { imagePath?: string }).imagePath === "string" ? (baseSlide as { imagePath: string }).imagePath : "",
      mobileImagePath: "",
      alt: clip(s.heading, 200),
      eyebrow: clip(s.eyebrow, 60),
      heading: clip(s.heading, 120),
      subheading: clip(s.subheading, 240),
      ctaLabel: clip(s.ctaLabel, 40),
      ctaHref: s.ctaHref,
    }));
  } else if (type === "CategoryGrid") {
    settings.mode = "manual";
    settings.eyebrow = settings.eyebrow || "Browse";
    settings.heading = settings.heading || "Shop by category";
    settings.items = plan.categories.map((c) => ({
      id: ids.categories[c.slug] ?? "",
      imagePath: "",
      label: "",
      subtitle: "",
    }));
  } else if (type === "CollectionGrid") {
    const colEntries = Object.entries(ids.collections);
    if (colEntries.length) {
      settings.mode = "manual";
      settings.eyebrow = settings.eyebrow || "Curated";
      settings.heading = settings.heading || "Shop the edit";
      settings.items = colEntries.slice(0, 4).map(([, id]) => ({ id, imagePath: "", label: "", subtitle: "" }));
    }
  } else if (type === "Testimonials") {
    settings.heading = settings.heading || "Loved by our customers";
    settings.items = plan.testimonials.slice(0, 8).map((t) => ({
      quote: clip(t.quote, 400),
      author: clip(t.author, 60),
      location: clip(t.location, 60),
      rating: t.rating,
    }));
  } else if (type === "BrandStory") {
    settings.eyebrow = settings.eyebrow || "Our story";
    settings.heading = typeof settings.heading === "string" && settings.heading ? settings.heading : "About us";
    settings.body = clip(plan.story, 1500);
  }
  return { ...section, settings };
}

async function mergeThemeContent(ctx: TenantContext, plan: ReadyStorePlan, ids: Ids): Promise<void> {
  const data = await getThemeEditorData(ctx.tenantId);
  const next = patchHomeSections(data.config, plan, ids);
  const parsed = parseThemeConfigStrict(next);
  if (!parsed.ok) {
    // Catalogue, navigation and SEO are already saved. A theme-shape mismatch must not
    // block account creation; the seller can edit the homepage in the builder.
    logger.warn("onboarding.seed_theme_merge_skipped", { tenantId: ctx.tenantId, issues: parsed.issues.slice(0, 8) });
    return;
  }
  if (!assetsBelongToTenant(parsed.config, ctx.tenantId)) {
    throw new AppError("VALIDATION", { fieldErrors: { _form: ["Some theme images don't belong to this store."] } });
  }
  const supabase = await createSupabaseServerClient();
  const { data: draft, error: draftError } = await supabase.from("theme_versions").select("id").eq("tenant_id", ctx.tenantId).eq("status", "draft").maybeSingle();
  if (draftError) throw mapDbError(draftError);
  if (draft) {
    const { error } = await supabase
      .from("theme_versions")
      .update({ config: parsed.config as unknown as Json })
      .eq("id", draft.id)
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "draft");
    if (error) throw mapDbError(error);
    return;
  }
  const { data: latest, error: latestError } = await supabase
    .from("theme_versions")
    .select("version")
    .eq("tenant_id", ctx.tenantId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw mapDbError(latestError);
  const { error } = await supabase.from("theme_versions").insert({
    tenant_id: ctx.tenantId,
    theme_key: "aangan",
    label: "Ready store seed",
    version: (latest?.version ?? 0) + 1,
    status: "draft",
    config: parsed.config as unknown as Json,
    created_by: ctx.user.id,
  });
  if (error) throw mapDbError(error);
}

/** Persist a validated plan into the tenant (idempotent by slug / menu handle). */
export async function persistReadyStore(
  ctx: TenantContext,
  args: { storeName: string; industry: IndustrySlug; plan: ReadyStorePlan },
): Promise<Omit<SeedReadyStoreResult, "themeKey" | "alreadySeeded">> {
  const cats = await ensureCategories(ctx.tenantId, args.plan);
  const cols = await ensureCollections(ctx.tenantId, args.plan);
  const prods = await ensureProducts(ctx.tenantId, args.industry, args.plan, args.storeName, cats.ids);
  const menu = await ensureMenu(ctx.tenantId, args.plan, cats.ids);
  await updateStoreSeo(ctx.tenantId, args.plan, args.storeName);
  const blogs = await ensureBlogs(ctx.tenantId, ctx.user.id, args.plan);
  await mergeThemeContent(ctx, args.plan, { categories: cats.ids, collections: cols.ids, products: prods.ids });

  return {
    categoryIds: Object.values(cats.ids),
    productIds: prods.ids,
    collectionIds: Object.values(cols.ids),
    blogIds: blogs.ids,
    menuId: menu.menuId,
    skipped: {
      categories: cats.skipped,
      products: prods.skipped,
      collections: cols.skipped,
      blogs: blogs.skipped,
      menu: menu.skipped,
    },
  };
}
