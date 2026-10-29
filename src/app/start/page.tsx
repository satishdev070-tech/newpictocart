import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { startSearchQuery } from "@/features/start/steps";

export const metadata: Metadata = {
  title: "Let's begin",
  description: "Pick your language and start building your Pictocart store with Tara.",
  robots: { index: false, follow: false },
};

/**
 * Bare `/start` always enters the journey at `/start/lang`.
 * Client `StartJourney` resumes from localStorage and replaces the URL to the saved screen.
 */
export default async function StartPage({ searchParams }: PageProps<"/start">) {
  const sp = await searchParams;
  const q = startSearchQuery(sp as Record<string, string | string[] | undefined>);
  redirect(q ? `/start/lang?${q}` : "/start/lang");
}
