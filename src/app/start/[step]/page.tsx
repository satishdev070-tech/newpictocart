import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StartPageContent } from "@/features/start/start-page";
import { isStartStepId, startSearchQuery } from "@/features/start/steps";

export const metadata: Metadata = {
  title: "Let's begin",
  description: "Pick your language and start building your Pictocart store with Tara.",
  robots: { index: false, follow: false },
};

/** Cache-first journey: language → path (voice|quiz) → build → account → ready store. */
export default async function StartStepPage({
  params,
  searchParams,
}: PageProps<"/start/[step]">) {
  const { step } = await params;
  const sp = await searchParams;

  if (!isStartStepId(step)) {
    const q = startSearchQuery(sp as Record<string, string | string[] | undefined>);
    redirect(q ? `/start/lang?${q}` : "/start/lang");
  }

  return <StartPageContent searchParams={sp} initialStep={step} />;
}
