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
import type { StartStepId } from "./steps";

export type StartPageSearchParams = {
  plan?: string | string[];
  theme?: string | string[];
  resume?: string | string[];
};

function firstString(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

/** Shared server loader + journey for `/start` and `/start/[step]`. */
export async function StartPageContent({
  searchParams,
  initialStep,
}: {
  searchParams: StartPageSearchParams;
  initialStep?: StartStepId;
}) {
  const plans = await getMarketingPlans();
  const plan = findPlan(plans, cleanPlanCode(firstString(searchParams.plan)))?.code ?? null;
  const themeRaw = firstString(searchParams.theme);
  const theme = themeRaw && isThemeKey(themeRaw) ? themeRaw : null;

  const user = await getSessionUser();
  const jar = await cookies();
  const draftCookie = jar.get(START_DRAFT_COOKIE)?.value === "1";
  const resume = firstString(searchParams.resume) === "1";
  const signedIn = Boolean(user);
  let landingPath: string | null = null;

  // Signed-in no-store users land on /start; keep them here for the five-screen flow
  // (resume=1 or no draft cookie yet). Do not redirect to /start or legacy /onboarding.
  if (user && !draftCookie && !resume) {
    const landing = await landingPathFor(user.id);
    const stayOnStart =
      landing === "/start" ||
      landing === "/onboarding" ||
      landing.startsWith("/start?") ||
      landing.startsWith("/start/") ||
      landing.startsWith("/onboarding?") ||
      landing.startsWith("/onboarding/");
    if (!stayOnStart) {
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
      initialStep={initialStep}
    />
  );
}
