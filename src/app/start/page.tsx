import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { landingPathFor } from "@/lib/auth/landing";
import { isThemeKey } from "@/features/marketing-site/themes";
import { getMarketingPlans } from "@/features/marketing-site/server/plans";
import { findPlan } from "@/features/marketing-site/plans";
import { cleanPlanCode } from "@/features/onboarding/steps";
import { StartJourney } from "@/features/start/components/start-journey";
import { START_DRAFT_COOKIE } from "@/features/start/draft/schema";
import { brandImageView, getPublicPlatformConfig } from "@/features/platform/server/public-config";
import { PLATFORM_LOGO, PLATFORM_NAME } from "@/config/platform";
import { publicEnv } from "@/lib/env/public";
import { googleSignInAvailable } from "@/features/auth/google";
import { isSarvamConfigured } from "@/lib/sarvam/client";

export const metadata: Metadata = {
  title: "Let's begin",
  description: "Pick your language and start building your Pictocart store with Tara.",
  robots: { index: false, follow: false },
};

/** Cache-first journey: language → path (voice|quiz) → build → account → ready store. */
export default async function StartPage({ searchParams }: PageProps<"/start">) {
  const sp = await searchParams;
  const plans = await getMarketingPlans();
  const plan = findPlan(plans, cleanPlanCode(sp.plan))?.code ?? null;
  const theme = typeof sp.theme === "string" && isThemeKey(sp.theme) ? sp.theme : null;

  const user = await getSessionUser();
  const jar = await cookies();
  const draftCookie = jar.get(START_DRAFT_COOKIE)?.value === "1";
  const resume = sp.resume === "1";
  const signedIn = Boolean(user);
  let landingPath: string | null = null;

  // Signed-in sellers with no store land on /onboarding historically; keep them on /start
  // for the five-screen flow (resume=1 or no draft cookie yet).
  if (user && !draftCookie && !resume) {
    const landing = await landingPathFor(user.id);
    if (landing !== "/onboarding") {
      redirect(landing);
    }
  }

  if (user) {
    landingPath = await landingPathFor(user.id);
  }

  const config = await getPublicPlatformConfig();
  const uploaded = brandImageView(config.headerLogo);
  const fallback = PLATFORM_LOGO;
  const logoSrc = uploaded?.src ?? fallback?.src ?? "";
  const logo = {
    src: logoSrc,
    width: uploaded?.width ?? fallback?.width ?? null,
    height: uploaded?.height ?? fallback?.height ?? null,
    name: PLATFORM_NAME,
  };

  const rootDomain = publicEnv().NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN;
  const googleAvailable = await googleSignInAvailable("sellers");
  const voiceReady = isSarvamConfigured();

  return (
    <StartJourney
      plan={plan}
      theme={theme}
      signedIn={signedIn}
      landingPath={landingPath}
      logo={logo}
      rootDomain={rootDomain}
      googleAvailable={googleAvailable}
      voiceReady={voiceReady}
    />
  );
}
