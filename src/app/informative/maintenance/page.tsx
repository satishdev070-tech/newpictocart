import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { informativePanelState } from "@/features/informative/server/context";
import { INFORMATIVE_HOME } from "@/features/informative/website-type";

export const metadata: Metadata = { title: "Under maintenance", robots: { index: false, follow: false } };

/**
 * Shown to Informative accounts while FEATURE_INFORMATIVE_WEBSITE is off, instead of a broken
 * panel. Everyone else gets the generic 404; with the flag on, Informative accounts go home.
 */
export default async function InformativeMaintenancePage() {
  const { decision } = await informativePanelState();
  if (decision === "render") redirect(INFORMATIVE_HOME);
  if (decision !== "maintenance") notFound();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <h1 className="font-display text-3xl">We&apos;ll be right back</h1>
      <p className="text-muted">Your website dashboard is temporarily unavailable while we make improvements. Your content is safe.</p>
    </main>
  );
}
