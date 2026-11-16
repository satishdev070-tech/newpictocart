import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { startSearchQuery } from "@/features/start/steps";

export const metadata: Metadata = {
  title: "Let's begin",
  description: "Pick your language and start building your Pictocart store with Tara.",
  robots: { index: false, follow: false },
};

/**
 * Bare `/start` always enters at `/start/lang` (language first, then /start/build when the
 * informative gate allows it). Client `StartJourney` resumes from localStorage and replaces the URL
 * with the saved screen.
 */
export default async function StartPage({ searchParams }: PageProps<"/start">) {
  const sp = await searchParams;
  const q = startSearchQuery(sp as Record<string, string | string[] | undefined>);
  redirect(q ? `/start/lang?${q}` : "/start/lang");
}
