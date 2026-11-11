import "server-only";
import { getSessionUser } from "@/lib/auth/session";
import { accountAccessFor } from "@/lib/auth/landing";
import { canCreateInformative, informativeFlagMode } from "../flag";

/**
 * May the current visitor start / complete an Informative Website onboarding? `all`: anyone;
 * `internal`: signed-in platform staff only; `off`: nobody. Read on the server per request.
 */
export async function informativeOnboardingAllowed(): Promise<boolean> {
  const mode = informativeFlagMode();
  if (mode === "off") return false;
  if (mode === "all") return true;
  const user = await getSessionUser();
  if (!user) return false;
  const access = await accountAccessFor(user.id);
  return canCreateInformative(mode, { platformStaff: access?.platformStaff ?? false });
}
