import { redirect } from "next/navigation";
import { LOGIN_PATH } from "@/lib/auth/landing";
import { safeRedirectPath } from "@/lib/http/safe-redirect";

/**
 * Old platform-console entry point: everyone signs in on the shared page now. Access to /admin is
 * still decided server-side by an active platform_memberships row, never by the URL used.
 * Temporary redirect (not 308) so the target can change without stale browser caches.
 */
export default async function AdminLoginRedirect({ searchParams }: PageProps<"/admin/login">) {
  const sp = await searchParams;
  const requested = typeof sp.next === "string" ? safeRedirectPath(sp.next, "/admin") : "/admin";
  const qs = new URLSearchParams({ next: requested.startsWith("/admin") ? requested : "/admin" });
  if (typeof sp.error === "string") qs.set("error", sp.error);
  redirect(`${LOGIN_PATH}?${qs}`);
}
