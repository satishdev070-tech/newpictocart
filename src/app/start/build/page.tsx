import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { informativeOnboardingAllowed } from "@/features/informative/server/onboarding-gate";
import { StartPageContent } from "@/features/start/start-page";
import { startSearchQuery } from "@/features/start/steps";

export const metadata: Metadata = { title: "What do you want to build?", robots: { index: false, follow: false } };

/**
 * Step 2, after language (docs/ONBOARDING_REDESIGN.md §2): Online Store or Informative Website,
 * rendered by StartJourney so draft, progress and Back stay in one place. Behind
 * FEATURE_INFORMATIVE_WEBSITE: when the gate does not allow this visitor, the step does not exist
 * and the journey goes lang → path, so this URL forwards to /start/lang (which resumes the draft).
 */
export default async function StartBuildPage({ searchParams }: PageProps<"/start/build">) {
  const sp = await searchParams;
  if (!(await informativeOnboardingAllowed())) {
    const q = startSearchQuery(sp as Record<string, string | string[] | undefined>);
    redirect(q ? `/start/lang?${q}` : "/start/lang");
  }
  return <StartPageContent searchParams={sp} initialStep="build" />;
}
