import { NextResponse, type NextRequest } from "next/server";
import { getRequestHost } from "@/lib/tenant/resolve";
import { tenantDirectory } from "@/lib/tenant/directory";
import { verifyPreviewToken } from "@/features/theme/server/preview";
import { PREVIEW_COOKIE, PREVIEW_TTL_SECONDS } from "@/features/theme/preview";
import { safeRedirectPath } from "@/lib/http/safe-redirect";

/** Installs (or clears) the draft-theme preview cookie for this store, then redirects. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const host = await getRequestHost();
  const origin = host ? `${url.protocol}//${request.headers.get("host") ?? host}` : url.origin;
  const res = NextResponse.redirect(new URL(safeRedirectPath(url.searchParams.get("path"), "/"), origin));
  res.headers.set("Cache-Control", "no-store");
  // The request URL here is the internal rewrite (/store/[host]/preview); judge by the real Host.
  const realHost = (request.headers.get("host") ?? url.host).split(":")[0]!.toLowerCase();
  const local = realHost === "localhost" || realHost.endsWith(".localhost");
  const secure = url.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https" || local;
  if (url.searchParams.get("exit")) {
    // A partitioned cookie is only cleared by a Set-Cookie with the same attributes.
    if (secure) res.cookies.set(PREVIEW_COOKIE, "", { httpOnly: true, secure: true, sameSite: "none", partitioned: true, path: "/", maxAge: 0 });
    else res.cookies.delete(PREVIEW_COOKIE);
    return res;
  }
  const token = url.searchParams.get("token");
  const tenant = host ? await tenantDirectory.findByHost(host) : null;
  if (!token || !tenant || !verifyPreviewToken(token, tenant.tenantId)) return res;
  // The site builder frames the store from the platform host. A store on a custom domain (or an
  // http *.localhost subdomain in dev) is cross-site to it, where SameSite=Lax cookies are dropped, so
  // the cookie is SameSite=None + Secure + Partitioned (CHIPS): it only exists in the frame's
  // partition (and the store's own, for the Preview tab). Secure is accepted on localhost over http.
  res.cookies.set(PREVIEW_COOKIE, token, secure ? { httpOnly: true, secure: true, sameSite: "none", partitioned: true, path: "/", maxAge: PREVIEW_TTL_SECONDS } : { httpOnly: true, sameSite: "lax", path: "/", maxAge: PREVIEW_TTL_SECONDS });
  return res;
}
