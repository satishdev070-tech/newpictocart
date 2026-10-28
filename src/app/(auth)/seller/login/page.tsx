import type { Metadata } from "next";
import { SharedSignInPage } from "@/features/auth/sign-in-page";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

/**
 * Old seller entry point (emails, bookmarks, marketing links). Renders the shared page instead of
 * redirecting: /login used to 308 here, and browsers cache that, so a redirect back would loop.
 */
export default async function SellerLoginPage({ searchParams }: PageProps<"/seller/login">) {
  return <SharedSignInPage searchParams={await searchParams} />;
}
