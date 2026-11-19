import "server-only";
import { serverEnv } from "@/lib/env/server";
import { logger } from "@/lib/observability/logger";
import { getAppCredential } from "@/features/platform-apps/server";
import { linkedinHeaders, linkedinPostBody, linkedinPostUrl } from "../payloads";
import type { Result } from "./providers";

/**
 * LinkedIn adapters (official docs):
 *   OAuth 2.0 (3-legged): /oauth/v2/authorization → POST /oauth/v2/accessToken (form body).
 *   OpenID Connect userinfo: GET /v2/userinfo → { sub, name }. Author = urn:li:person:{sub}.
 *   Organization admin check: GET /rest/organizationAcls?q=roleAssignee (versioned REST).
 *   Images API: POST /rest/images?action=initializeUpload → PUT bytes to uploadUrl.
 *   Posts API: POST /rest/posts → 201, post URN in the x-restli-id header.
 * Tokens travel only in the Authorization header and are never logged.
 */

const TIMEOUT = 15_000;
const API = "https://api.linkedin.com";
export const LINKEDIN_SCOPES = ["openid", "profile", "w_member_social"];

const version = () => serverEnv().LINKEDIN_API_VERSION;

async function json(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

function fail(status: number, body: Record<string, unknown>, message: string): { ok: false; message: string; expired?: boolean } {
  logger.warn("social.api_error", { provider: "linkedin", status, code: body.serviceErrorCode ?? body.code ?? body.error });
  const expired = status === 401 || body.error === "invalid_grant";
  if (expired) return { ok: false, message: "The LinkedIn connection has expired or was revoked. Reconnect LinkedIn.", expired: true };
  if (status === 403) return { ok: false, message: `${message} LinkedIn says the token doesn't have permission for this (check w_member_social or w_organization_social).` };
  return { ok: false, message };
}

async function app(): Promise<{ id: string; secret: string } | null> {
  const c = await getAppCredential("linkedin");
  return c?.clientId ? { id: c.clientId, secret: c.secret } : null;
}

export async function linkedinConfigured(): Promise<boolean> {
  return (await app()) !== null;
}

export async function linkedinAuthUrl(redirectUri: string, state: string): Promise<string | null> {
  const c = await app();
  if (!c) return null;
  const q = new URLSearchParams({ response_type: "code", client_id: c.id, redirect_uri: redirectUri, state, scope: LINKEDIN_SCOPES.join(" ") });
  return `https://www.linkedin.com/oauth/v2/authorization?${q}`;
}

export type LinkedInTokens = { accessToken: string; refreshToken: string | null; expiresAt: string | null };

async function tokenRequest(body: Record<string, string>): Promise<Result<LinkedInTokens>> {
  const c = await app();
  if (!c) return { ok: false, message: "LinkedIn isn't set up on the platform yet." };
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...body, client_id: c.id, client_secret: c.secret }),
    signal: AbortSignal.timeout(TIMEOUT),
    cache: "no-store",
  });
  const j = await json(res);
  if (!res.ok || typeof j.access_token !== "string") return fail(res.status, j, "LinkedIn didn't accept the sign-in. Try connecting again.");
  return {
    ok: true,
    data: {
      accessToken: j.access_token,
      refreshToken: typeof j.refresh_token === "string" ? j.refresh_token : null,
      expiresAt: typeof j.expires_in === "number" ? new Date(Date.now() + j.expires_in * 1000).toISOString() : null,
    },
  };
}

export const linkedinExchange = (code: string, redirectUri: string) => tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
/** Only LinkedIn-approved apps receive refresh tokens; others reconnect after 60 days. */
export const linkedinRefresh = (refreshToken: string) => tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });

/** The member behind a token (OpenID Connect). */
export async function linkedinMember(token: string): Promise<Result<{ id: string; name: string }>> {
  const res = await fetch(`${API}/v2/userinfo`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" });
  const j = await json(res);
  if (!res.ok || typeof j.sub !== "string") return fail(res.status, j, "LinkedIn rejected the connection check.");
  return { ok: true, data: { id: j.sub, name: typeof j.name === "string" && j.name ? j.name : "LinkedIn member" } };
}

/** Confirms the token's member administers the organization, and reads its name. */
export async function linkedinOrganization(token: string, orgId: string): Promise<Result<{ name: string }>> {
  const urn = `urn:li:organization:${orgId}`;
  const acl = await fetch(`${API}/rest/organizationAcls?${new URLSearchParams({ q: "roleAssignee", role: "ADMINISTRATOR", state: "APPROVED" })}`, {
    headers: linkedinHeaders(token, version()),
    signal: AbortSignal.timeout(TIMEOUT),
    cache: "no-store",
  });
  const aj = await json(acl);
  if (!acl.ok) return fail(acl.status, aj, "LinkedIn didn't confirm that you manage this company page.");
  const orgs = ((aj.elements as { organization?: string; organizationTarget?: string }[]) ?? []).map((e) => e.organization ?? e.organizationTarget);
  if (!orgs.includes(urn)) return { ok: false, message: "This token's member isn't an administrator of that LinkedIn company page." };
  const org = await fetch(`${API}/rest/organizations/${encodeURIComponent(orgId)}`, { headers: linkedinHeaders(token, version()), signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" });
  const oj = await json(org);
  return { ok: true, data: { name: org.ok && typeof oj.localizedName === "string" ? oj.localizedName : `Company page ${orgId}` } };
}

/** Uploads one image for `author` and returns its image URN. */
async function uploadImage(token: string, author: string, imageUrl: string): Promise<Result<string>> {
  const init = await fetch(`${API}/rest/images?action=initializeUpload`, {
    method: "POST",
    headers: linkedinHeaders(token, version()),
    body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const ij = await json(init);
  const value = (ij.value ?? {}) as { uploadUrl?: unknown; image?: unknown };
  if (!init.ok || typeof value.uploadUrl !== "string" || typeof value.image !== "string") return fail(init.status, ij, "LinkedIn couldn't start the image upload.");
  if (!value.uploadUrl.startsWith("https://")) return { ok: false, message: "LinkedIn returned an unexpected upload address." };
  const img = await fetch(imageUrl, { signal: AbortSignal.timeout(20_000) });
  if (!img.ok) return { ok: false, message: "The post image couldn't be read." };
  const bytes = await img.arrayBuffer();
  if (bytes.byteLength > 8_000_000) return { ok: false, message: "The image is too large for LinkedIn (max 8 MB)." };
  const put = await fetch(value.uploadUrl, { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: bytes, signal: AbortSignal.timeout(30_000) });
  if (!put.ok) return fail(put.status, {}, "LinkedIn didn't accept the image.");
  return { ok: true, data: value.image };
}

/** Publishes a post (with the image when one is given) as `author` (person or organization URN). */
export async function publishLinkedIn(token: string, author: string, text: string, imageUrl: string | null, altText: string): Promise<Result<{ id: string; url: string | null }>> {
  let image: { urn: string; altText: string } | null = null;
  if (imageUrl) {
    const up = await uploadImage(token, author, imageUrl);
    if (!up.ok) return up;
    image = { urn: up.data, altText };
  }
  const res = await fetch(`${API}/rest/posts`, {
    method: "POST",
    headers: linkedinHeaders(token, version()),
    body: JSON.stringify(linkedinPostBody(author, text, image)),
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status !== 201) return fail(res.status, await json(res), "LinkedIn didn't accept the post.");
  const id = res.headers.get("x-restli-id") ?? "";
  return { ok: true, data: { id: id || "linkedin", url: linkedinPostUrl(id) } };
}
