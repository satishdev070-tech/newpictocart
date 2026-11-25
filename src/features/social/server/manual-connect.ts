import "server-only";
import { AppError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TenantContext } from "@/lib/tenant/membership";
import { saveOAuthConnection } from "@/features/integrations/server/store";
import type { ProviderId } from "@/features/integrations/registry";
import { metaManualPages } from "./providers";
import { linkedinMember, linkedinOrganization } from "./linkedin";
import { linkedinAuthorUrn } from "../payloads";

/**
 * "Connect with your own token": the seller pastes credentials from their own Meta / LinkedIn
 * developer app. Each is checked against the provider BEFORE anything is stored, then saved
 * exactly like an OAuth connection (encrypted in tenant_integrations, connect_method "manual").
 * A Meta App secret is used once for the long-lived token swap and never stored.
 * Callers have already run marketingCtx() (membership + marketing.write + social_media).
 */

/** A Page / Instagram account / LinkedIn author belongs to one store (webhook routing, no cross-posting). */
async function assertNotTaken(tenantId: string, provider: ProviderId, key: string, value: string) {
  const { data } = await createSupabaseAdminClient().from("tenant_integrations").select("tenant_id").eq("provider", provider).eq(`public_config->>${key}`, value).neq("tenant_id", tenantId).limit(1);
  if (data?.length) throw new AppError("CONFLICT", { message: "This account is already connected to another store." });
}

export async function connectMetaManual(ctx: TenantContext, input: { token: string; pageId?: string; appId?: string; appSecret?: string; instagram: boolean }): Promise<string> {
  if ((input.appId && !input.appSecret) || (!input.appId && input.appSecret)) throw new AppError("VALIDATION", { fieldErrors: { appSecret: ["Enter both the App ID and the App secret, or neither"] } });
  const r = await metaManualPages({ token: input.token, appId: input.appId, appSecret: input.appSecret });
  if (!r.ok) throw new AppError("VALIDATION", { fieldErrors: { token: [r.message] } });
  const pages = r.data.pages;
  const page = input.pageId ? pages.find((p) => p.id === input.pageId) : pages.length === 1 ? pages[0] : undefined;
  if (!page) {
    const list = pages.slice(0, 8).map((p) => `${p.name} (${p.id})`).join(", ");
    throw new AppError("VALIDATION", { fieldErrors: { pageId: [input.pageId ? `This token can't manage that Page. Pages it can manage: ${list}` : `This token manages several Pages. Enter the Page ID of your store's Page: ${list}`] } });
  }
  await assertNotTaken(ctx.tenantId, "facebook", "account_id", page.id);
  const method = { connect_method: "manual", ...(input.appId ? { app_id: input.appId } : {}) };
  await saveOAuthConnection(ctx.tenantId, ctx.user.id, "facebook", { publicConfig: { account_id: page.id, account_name: page.name, ...method }, secrets: { page_token: page.accessToken }, expiresAt: r.data.expiresAt });
  const connected = [`Facebook Page "${page.name}"`];
  if (input.instagram && page.instagram) {
    await assertNotTaken(ctx.tenantId, "instagram", "account_id", page.instagram.id);
    await saveOAuthConnection(ctx.tenantId, ctx.user.id, "instagram", {
      publicConfig: { account_id: page.instagram.id, account_name: page.instagram.username ? `@${page.instagram.username}` : page.name, page_id: page.id, ...method },
      secrets: { page_token: page.accessToken },
      expiresAt: r.data.expiresAt,
    });
    connected.push(`Instagram ${page.instagram.username ? `@${page.instagram.username}` : "account"}`);
  }
  const igNote = input.instagram && !page.instagram ? " No Instagram professional account is linked to this Page, so Instagram wasn't connected." : "";
  const expiryNote = r.data.expiresAt ? " This token is short-lived (about an hour). Add your App ID and App secret to get a token that doesn't expire." : "";
  return `Connected: ${connected.join(" and ")}.${igNote}${expiryNote}`;
}

export async function connectLinkedInManual(ctx: TenantContext, input: { token: string; organizationId?: string }): Promise<string> {
  let author: string | null;
  let name: string;
  if (input.organizationId) {
    author = linkedinAuthorUrn("organization", input.organizationId);
    if (!author) throw new AppError("VALIDATION", { fieldErrors: { organizationId: ["Use the numeric company page ID"] } });
    const org = await linkedinOrganization(input.token, input.organizationId);
    if (!org.ok) throw new AppError("VALIDATION", { fieldErrors: { token: [org.message] } });
    name = org.data.name;
  } else {
    const me = await linkedinMember(input.token);
    if (!me.ok) throw new AppError("VALIDATION", { fieldErrors: { token: [me.message] } });
    author = linkedinAuthorUrn("person", me.data.id);
    if (!author) throw new AppError("VALIDATION", { fieldErrors: { token: ["LinkedIn returned an unexpected member id."] } });
    name = me.data.name;
  }
  await assertNotTaken(ctx.tenantId, "linkedin", "author_urn", author);
  await saveOAuthConnection(ctx.tenantId, ctx.user.id, "linkedin", {
    publicConfig: { account_id: author, account_name: name, author_urn: author, author_kind: input.organizationId ? "organization" : "person", connect_method: "manual" },
    secrets: { access_token: input.token },
    expiresAt: null,
  });
  return `Connected LinkedIn: ${name}.`;
}
