import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import { AppError } from "@/lib/errors";
import type { TenantPermission } from "@/lib/permissions/matrix";
import type { Json } from "@/lib/supabase/database.types";
import { toPage, type InfoPage } from "../model";
import type { PageSection } from "../sections";

/**
 * Website editor data access. Same contract as ./repo.ts: the member context comes from
 * requireInformativeTenant() (tenant never from input), the permission is checked here, and the
 * member's own session runs the query so RLS enforces the same rule.
 */
type Ctx = { tenantId: string; permissions: ReadonlySet<TenantPermission> };
export type EditorPage = InfoPage & { updatedAt: string };

function need(ctx: Ctx, permission: TenantPermission): void {
  if (!ctx.permissions.has(permission)) throw new AppError("FORBIDDEN", { context: { permission } });
}

/** Every page of the site (published or not), system pages first in their saved order. */
export async function listEditorPages(ctx: Ctx): Promise<EditorPage[]> {
  need(ctx, "store.read");
  const { data, error } = await (await createSupabaseServerClient())
    .from("info_pages")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .is("deleted_at", null)
    .order("sort_order")
    .order("created_at");
  if (error) throw mapDbError(error, { op: "info.editor.listPages" });
  return (data ?? []).map((r) => ({ ...toPage(r), updatedAt: r.updated_at }));
}

/** `ref` = a page id or "home". */
export function findEditorPage(pages: readonly EditorPage[], ref: string | null | undefined): EditorPage | null {
  if (!ref || ref === "home") return pages.find((p) => p.type === "HOME") ?? pages[0] ?? null;
  return pages.find((p) => p.id === ref) ?? null;
}

/**
 * Writes a page's sections. With `expectedUpdatedAt`, the write only lands if nobody saved the page
 * since the editor loaded it (otherwise CONFLICT). Returns the new updated_at.
 */
export async function saveEditorPageSections(ctx: Ctx, pageId: string, sections: PageSection[], expectedUpdatedAt: string | null): Promise<string> {
  need(ctx, "content.write");
  const client = await createSupabaseServerClient();
  const ordered = sections.map((s, i) => ({ ...s, order: i }));
  let q = client
    .from("info_pages")
    .update({ sections: ordered as unknown as Json })
    .eq("tenant_id", ctx.tenantId)
    .eq("id", pageId)
    .is("deleted_at", null);
  if (expectedUpdatedAt) q = q.eq("updated_at", expectedUpdatedAt);
  const { data, error } = await q.select("updated_at").maybeSingle();
  if (error) throw mapDbError(error, { op: "info.editor.savePage" });
  if (data) return data.updated_at;
  if (!expectedUpdatedAt) throw new AppError("NOT_FOUND");
  const { data: exists, error: e2 } = await client.from("info_pages").select("id").eq("tenant_id", ctx.tenantId).eq("id", pageId).is("deleted_at", null).maybeSingle();
  if (e2) throw mapDbError(e2, { op: "info.editor.pageExists" });
  throw new AppError(exists ? "CONFLICT" : "NOT_FOUND", { context: { pageId } });
}
