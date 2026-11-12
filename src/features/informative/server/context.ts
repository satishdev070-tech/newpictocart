import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { loginPathFor } from "@/lib/auth/landing";
import { ACTIVE_TENANT_COOKIE, listMemberships, membershipPermissions, type Membership } from "@/lib/tenant/membership";
import type { TenantPermission } from "@/lib/permissions/matrix";
import { AppError } from "@/lib/errors";
import { informativeFlagMode } from "../flag";
import { informativePanelDecision, type InformativePanelDecision } from "../guard";
import { INFORMATIVE_HOME } from "../website-type";

/** Request context of the Informative seller panel. Tenant = the member's active membership. */
export type InformativeContext = {
  user: SessionUser;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  tenantStatus: Membership["tenantStatus"];
  role: Membership["role"];
  permissions: ReadonlySet<TenantPermission>;
  memberships: Membership[];
  websiteType: "INFORMATIVE";
};

type Resolved = { decision: InformativePanelDecision; ctx: InformativeContext | null };

/** Same active-store rule as requireTenant(): the cookie is only a hint, re-checked against memberships. */
const resolve = cache(async (): Promise<Resolved> => {
  const mode = informativeFlagMode();
  const user = await getSessionUser();
  let active: Membership | null = null;
  let memberships: Membership[] = [];
  if (user) {
    memberships = await listMemberships(user.id);
    const hinted = (await cookies()).get(ACTIVE_TENANT_COOKIE)?.value;
    active = memberships.find((m) => m.tenantId === hinted) ?? memberships[0] ?? null;
  }
  const decision = informativePanelDecision({ mode, signedIn: Boolean(user), activeType: active?.websiteType ?? null });
  const ctx =
    decision === "render" && user && active
      ? {
          user,
          tenantId: active.tenantId,
          tenantName: active.tenantName,
          tenantSlug: active.tenantSlug,
          tenantStatus: active.tenantStatus,
          role: active.role,
          permissions: membershipPermissions(active),
          memberships,
          websiteType: "INFORMATIVE" as const,
        }
      : null;
  return { decision, ctx };
});

/** Guard state for the panel layout (maintenance is rendered there, not thrown). */
export async function informativePanelState(): Promise<Resolved> {
  return resolve();
}

/**
 * InformativeRouteGuard for pages and server actions. Store accounts are sent to the store
 * dashboard, signed-out visitors to login; with the flag off the panel 404s (Informative
 * accounts are shown the maintenance page instead).
 */
export async function requireInformativeTenant(): Promise<InformativeContext> {
  const { decision, ctx } = await resolve();
  switch (decision) {
    case "render":
      return ctx!;
    case "login":
      redirect(loginPathFor(INFORMATIVE_HOME));
    case "onboarding":
      redirect("/start");
    case "store-dashboard":
      redirect("/dashboard");
    case "maintenance":
      redirect("/informative/maintenance");
    case "not-found":
      notFound();
  }
}

/** Server-action permission check (RLS enforces the same rule in the database). */
export function assertInformativePermission(ctx: Pick<InformativeContext, "permissions">, permission: TenantPermission): void {
  if (!ctx.permissions.has(permission)) throw new AppError("FORBIDDEN", { context: { permission } });
}
