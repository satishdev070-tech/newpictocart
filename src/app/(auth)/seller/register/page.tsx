import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MerchantSignUp } from "@/features/auth/merchant-auth";
import { getSessionUser } from "@/lib/auth/session";
import { landingPathFor } from "@/lib/auth/landing";
import { safeRedirectPath } from "@/lib/http/safe-redirect";
import { AuthHeading, AuthSplit } from "@/components/auth/auth-split";
import { MerchantAside } from "@/components/auth/auth-asides";
import { GoogleSignInSlot } from "@/components/auth/google-sign-in-slot";
import { findTheme, isThemeKey } from "@/features/marketing-site/themes";
import { getMarketingPlans } from "@/features/marketing-site/server/plans";
import { entryPlan, findPlan, isFreeForeverPlan, signupTrialDays } from "@/features/marketing-site/plans";
import { cleanPlanCode } from "@/features/onboarding/steps";
import { isSarvamLocaleCode } from "@/lib/sarvam/locales";
import { isStartIntentId } from "@/features/start/intents";

export const metadata: Metadata = { title: "Create your store", robots: { index: false, follow: false } };

export default async function SellerRegisterPage({ searchParams }: PageProps<"/seller/register">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? safeRedirectPath(sp.next, "") : "";
  const theme = typeof sp.theme === "string" && isThemeKey(sp.theme) ? sp.theme : null;
  const plans = await getMarketingPlans();
  const plan = findPlan(plans, cleanPlanCode(sp.plan))?.code ?? null;
  const lang = typeof sp.lang === "string" && isSarvamLocaleCode(sp.lang) ? sp.lang : null;
  const intent = typeof sp.intent === "string" && isStartIntentId(sp.intent) ? sp.intent : null;
  const qs = new URLSearchParams();
  if (plan) qs.set("plan", plan);
  if (theme) qs.set("theme", theme);
  if (lang) qs.set("lang", lang);
  const onboarding = qs.size ? `/onboarding?${qs}` : "/onboarding";

  // Already signed in: continue setup (or the dashboard) instead of creating a second account.
  const user = await getSessionUser();
  if (user) {
    const landing = await landingPathFor(user.id);
    redirect(next || (landing === "/onboarding" ? onboarding : landing));
  }

  const trial = signupTrialDays(plans);
  const freeForever = Boolean(entryPlan(plans) && isFreeForeverPlan(entryPlan(plans)!));
  const themeName = theme ? findTheme(theme)?.name : null;
  const planName = plan ? findPlan(plans, plan)?.name : null;
  return (
    <AuthSplit variant="merchant" aside={<MerchantAside mode="register" />}>
      <AuthHeading
        eyebrow="Create account"
        title="Create your store"
        description={
          freeForever
            ? "Free forever for up to 10 products. No card details needed."
            : trial > 0
              ? `Start with a ${trial}-day free trial. No card details needed.`
              : "No card details needed."
        }
      />
      {themeName || planName || lang ? (
        <p className="-mt-4 mb-6 flex flex-wrap gap-2 text-caption" aria-label="Your selections">
          {lang ? <span className="rounded-full bg-accent-soft px-2.5 py-1 font-semibold text-accent">Language: {lang}</span> : null}
          {themeName ? <span className="rounded-full bg-accent-soft px-2.5 py-1 font-semibold text-accent">Theme: {themeName}</span> : null}
          {planName ? <span className="rounded-full bg-accent-soft px-2.5 py-1 font-semibold text-accent">Plan: {planName}</span> : null}
        </p>
      ) : null}
      <GoogleSignInSlot next={next || onboarding} text="signup_with" label="Sign up with Google" />
      <MerchantSignUp next={next || undefined} plan={plan} theme={theme} lang={lang} intent={intent} />
      <p className="mt-6 text-center text-small text-muted">
        Already have a store?{" "}
        <a href="/login" className="font-semibold text-accent underline-offset-2 hover:underline">
          Sign in
        </a>
      </p>
    </AuthSplit>
  );
}
