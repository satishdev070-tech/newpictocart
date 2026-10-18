import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";
import { storeOrigin, storeSubdomain } from "@/lib/platform/urls";
import type { TenantContext } from "@/lib/tenant/membership";
import { can } from "@/lib/tenant/membership";
import { getEditorPickers, getThemeEditorData } from "@/features/theme/server/queries";
import { menuHandles } from "@/features/theme/render/load";
import { linkFromMenuRow, type ThemeMenu, type ThemeMenuItem } from "@/features/theme/schema/links";
import { loadProviders } from "@/features/neural-pulse/server/generate";
import { paths } from "@/features/storefront/urls";
import type { BuilderData } from "../context";

/**
 * Everything the site builder needs, read with the seller's session (RLS) for the tenant the
 * caller resolved from membership (requireTenantPermission("theme.edit")).
 */
export async function getBuilderData(ctx: TenantContext): Promise<BuilderData> {
  const tenantId = ctx.tenantId;
  const supabase = await createSupabaseServerClient();
  const [data, pickers, pages, product, collection, store, aiProviders] = await Promise.all([
    getThemeEditorData(tenantId),
    getEditorPickers(tenantId),
    supabase.from("pages").select("id, title, slug").eq("tenant_id", tenantId).order("title").limit(100),
    supabase.from("products").select("slug").eq("tenant_id", tenantId).eq("status", "active").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("collections").select("slug").eq("tenant_id", tenantId).order("position").limit(1).maybeSingle(),
    supabase.from("stores").select("name, whatsapp").eq("tenant_id", tenantId).maybeSingle(),
    loadProviders().catch(() => []),
  ]);
  const dbMenus = await loadDbMenus(tenantId, menuHandles(data.config));
  return {
    initial: data.config,
    draftUpdatedAt: data.draftUpdatedAt,
    pickers,
    history: data.history,
    publishedVersion: data.published?.version ?? null,
    canPublish: can(ctx, "theme.publish"),
    issues: data.issues.map((i) => `${i.path}: ${i.message}`),
    store: { name: store.data?.name ?? ctx.tenantName, slug: ctx.tenantSlug, origin: storeOrigin(storeSubdomain(ctx.tenantSlug)), whatsapp: store.data?.whatsapp ?? null },
    dbMenus,
    pageSources: {
      contentPages: (pages.data ?? []).map((p) => ({ id: p.id, title: p.title, slug: p.slug })),
      sampleProductSlug: product.data?.slug ?? null,
      sampleCollectionSlug: collection.data?.slug ?? null,
      blog: true,
    },
    aiEnabled: aiProviders.length > 0,
  };
}

/** Database menus as theme menus, so the builder can show and copy them on first edit. */
async function loadDbMenus(tenantId: string, handles: string[]): Promise<Record<string, ThemeMenu>> {
  if (!handles.length) return {};
  const supabase = await createSupabaseServerClient();
  const { data: menus, error } = await supabase.from("menus").select("id, handle, title").eq("tenant_id", tenantId).in("handle", handles);
  if (error) logger.warn("site_builder.menus_failed", { tenantId, error: error.message });
  if (!menus?.length) return {};
  const { data: rows } = await supabase
    .from("menu_items")
    .select("id, menu_id, parent_id, title, link_type, link_ref, url, highlight, position")
    .eq("tenant_id", tenantId)
    .in(
      "menu_id",
      menus.map((m) => m.id),
    )
    .order("position")
    .limit(600);
  const items = rows ?? [];
  const catIds = [...new Set(items.filter((r) => r.link_type === "category" && r.link_ref).map((r) => r.link_ref!))];
  const { data: cats } = catIds.length ? await supabase.from("categories").select("id, slug").eq("tenant_id", tenantId).in("id", catIds) : { data: [] };
  const catSlug = new Map((cats ?? []).map((c) => [c.id, c.slug]));
  const toItem = (r: (typeof items)[number], children: ThemeMenuItem["children"]): ThemeMenuItem => {
    const slug = r.link_type === "category" && r.link_ref ? catSlug.get(r.link_ref) : undefined;
    const link = slug ? { type: "url" as const, ref: "", url: paths.category(slug), anchor: "", newTab: false } : linkFromMenuRow(r);
    return { id: `m${r.id.replace(/-/g, "").slice(0, 12)}`, title: (r.title || "Link").slice(0, 60), link, highlight: !!r.highlight, children };
  };
  const out: Record<string, ThemeMenu> = {};
  for (const m of menus) {
    const mine = items.filter((r) => r.menu_id === m.id);
    const top = mine.filter((r) => !r.parent_id).slice(0, 40);
    out[m.handle] = {
      title: m.title,
      items: top.map((t) =>
        toItem(
          t,
          mine
            .filter((c) => c.parent_id === t.id)
            .slice(0, 20)
            .map((c) => {
              const { children: _c, ...rest } = toItem(c, []);
              return rest;
            }),
        ),
      ),
    };
  }
  return out;
}
