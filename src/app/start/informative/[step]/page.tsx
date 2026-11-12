import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { googleSignInAvailable } from "@/features/auth/google";
import { isInfoStep } from "@/features/informative/onboarding/draft";
import { InformativeJourney } from "@/features/informative/onboarding/components/journey";
import { informativeOnboardingAllowed } from "@/features/informative/server/onboarding-gate";
import { onboardingLogo, themeCards } from "@/features/informative/server/onboarding-page";
import { getSessionUser } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env/public";

export const metadata: Metadata = { title: "Create your website", robots: { index: false, follow: false } };

/** Informative onboarding steps 1–4 + finish. 404 unless FEATURE_INFORMATIVE_WEBSITE allows this visitor. */
export default async function InformativeStartStepPage({ params }: PageProps<"/start/informative/[step]">) {
  if (!(await informativeOnboardingAllowed())) notFound();
  const { step } = await params;
  if (!isInfoStep(step)) redirect("/start/informative/basic-info");
  const user = await getSessionUser();
  if (step === "finish" && !user) redirect("/start/informative/account");
  const [logo, googleAvailable] = await Promise.all([onboardingLogo(), googleSignInAvailable("sellers")]);
  return (
    <InformativeJourney
      step={step}
      logo={logo}
      rootDomain={publicEnv().NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN}
      themes={themeCards()}
      signedIn={Boolean(user)}
      googleAvailable={googleAvailable}
    />
  );
}
