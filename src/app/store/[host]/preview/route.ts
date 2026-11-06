import { NextResponse, type NextRequest } from "next/server";
import { getRequestHost } from "@/lib/tenant/resolve";
import { tenantDirectory } from "@/lib/tenant/directory";
import { diagnosePreviewToken } from "@/features/theme/server/preview";
import { PREVIEW_COOKIE, PREVIEW_TTL_SECONDS, type PreviewTokenFailReason } from "@/features/theme/preview";
import { safeRedirectPath } from "@/lib/http/safe-redirect";
import { publicEnv } from "@/lib/env/public";
import { logger } from "@/lib/observability/logger";

type PreviewFailReason = "missing_token" | "unknown_host" | PreviewTokenFailReason;

/** Single-level `{slug}.{root}` hosts are same-site to the dashboard — use Lax, not CHIPS. */
function isPlatformSubdomainHost(host: string, rootDomain: string): boolean {
  const h = host.toLowerCase();
  const root = rootDomain.toLowerCase();
  if (!root || !h.endsWith(`.${root}`)) return false;
  const sub = h.slice(0, -(root.length + 1));
  return sub.length > 0 && !sub.includes(".");
}

function previewDenied(reason: PreviewFailReason): NextResponse {
  logger.warn("theme.preview_denied", { reason });
  // Notify the Theme Editor parent frame (cross-origin) so it can renew the token instead of
  // hanging at “Loading 92%”. Reason is non-secret (no token / tenant id).
  const body = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Preview unavailable</title></head><body data-preview-error="${reason}"><p>Preview unavailable (${reason}). Close and reopen the theme editor.</p><script>try{parent.postMessage({source:"pictocart-preview",type:"denied",reason:${JSON.stringify(reason)}},"*")}catch(e){}</script></body></html>`;
  return new NextResponse(body, {
    status: 403,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function clearPreviewCookies(res: NextResponse, secure: boolean) {
  // Clear both cookie shapes so a prior CHIPS cookie cannot linger after we switch to Lax.
  if (secure) {
    res.cookies.set(PREVIEW_COOKIE, "", { httpOnly: true, secure: true, sameSite: "none", partitioned: true, path: "/", maxAge: 0 });
    res.cookies.set(PREVIEW_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  } else {
    res.cookies.delete(PREVIEW_COOKIE);
  }
}

/** Installs (or clears) the draft-theme preview cookie for this store, then redirects. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const host = await getRequestHost();
  const origin = host ? `${url.protocol}//${request.headers.get("host") ?? host}` : url.origin;
  // The request URL here is the internal rewrite (/store/[host]/preview); judge by the real Host.
  const realHost = (request.headers.get("host") ?? url.host).split(":")[0]!.toLowerCase();
  const local = realHost === "localhost" || realHost.endsWith(".localhost");
  const secure = url.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https" || local;
  const root = publicEnv().NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN;
  const platformSub = Boolean(host && isPlatformSubdomainHost(host, root));

  if (url.searchParams.get("exit")) {
    const res = NextResponse.redirect(new URL(safeRedirectPath(url.searchParams.get("path"), "/"), origin));
    res.headers.set("Cache-Control", "no-store");
    clearPreviewCookies(res, secure);
    return res;
  }

  const token = url.searchParams.get("token");
  if (!token) return previewDenied("missing_token");
  if (!host) return previewDenied("unknown_host");
  const tenant = await tenantDirectory.findByHost(host);
  if (!tenant) return previewDenied("unknown_host");
  const diagnosed = diagnosePreviewToken(token, tenant.tenantId);
  if (!diagnosed.ok) {
    logger.warn("theme.preview_denied", { reason: diagnosed.reason, host, tenantId: tenant.tenantId });
    return previewDenied(diagnosed.reason);
  }

  const res = NextResponse.redirect(new URL(safeRedirectPath(url.searchParams.get("path"), "/"), origin));
  res.headers.set("Cache-Control", "no-store");
  // Drop any leftover CHIPS cookie before installing the active one — browsers can keep both
  // Partitioned and non-Partitioned cookies with the same name, and the wrong one may win.
  if (secure) {
    res.cookies.set(PREVIEW_COOKIE, "", { httpOnly: true, secure: true, sameSite: "none", partitioned: true, path: "/", maxAge: 0 });
  }
  // Platform subdomains are same-site to the dashboard (e.g. pictocart.in ↔ slug.pictocart.in):
  // SameSite=Lax is enough and more reliable in the editor iframe than CHIPS.
  // Custom domains (and http *.localhost) are cross-site → SameSite=None; Secure; Partitioned.
  if (!secure) {
    res.cookies.set(PREVIEW_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: PREVIEW_TTL_SECONDS });
  } else if (platformSub) {
    res.cookies.set(PREVIEW_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: PREVIEW_TTL_SECONDS });
  } else {
    res.cookies.set(PREVIEW_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      partitioned: true,
      path: "/",
      maxAge: PREVIEW_TTL_SECONDS,
    });
  }
  return res;
}
