import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { landingPathFor } from "@/lib/auth/landing";
import { isThemeKey } from "@/features/marketing-site/themes";
import { getMarketingPlans } from "@/features/marketing-site/server/plans";
import { findPlan } from "@/features/marketing-site/plans";
import { cleanPlanCode } from "@/features/onboarding/steps";
import { StartJourney } from "@/features/start/components/start-journey";

export const metadata: Metadata = {
  title: "Let's begin",
  description: "Pick your language and start building your Pictocart store with Tara.",
  robots: { index: false, follow: false },
};

/** Pre-auth prototype-style journey: welcome → language → intent → register. */
export default async function StartPage({ searchParams }: PageProps<"/start">) {
  const sp = await searchParams;
  const plans = await getMarketingPlans();
  const plan = findPlan(plans, cleanPlanCode(sp.plan))?.code ?? null;
  const theme = typeof sp.theme === "string" && isThemeKey(sp.theme) ? sp.theme : null;

  const user = await getSessionUser();
  if (user) {
    const landing = await landingPathFor(user.id);
    const qs = new URLSearchParams();
    if (plan) qs.set("plan", plan);
    if (theme) qs.set("theme", theme);
    redirect(landing === "/onboarding" && qs.size ? `/onboarding?${qs}` : landing);
  }

  return <StartJourney plan={plan} theme={theme} />;
}
