import "server-only";
import { cookies } from "next/headers";
import { START_DRAFT_COOKIE } from "./schema";

/**
 * Expire the in-progress `/start` draft cookie from a Server Component / action.
 * Used when signed-in panel users leave `/login` via server `redirect()` so we
 * do not rely on the client-only clear that used to run before `router.replace`.
 * localStorage is best-effort on the destination; resume gates key off this cookie.
 */
export async function clearStartDraftCookieServer(): Promise<void> {
  const jar = await cookies();
  jar.set(START_DRAFT_COOKIE, "", { path: "/", maxAge: 0, sameSite: "lax" });
}
