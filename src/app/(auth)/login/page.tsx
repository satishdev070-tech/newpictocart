import type { Metadata } from "next";
import { SharedSignInPage } from "@/features/auth/sign-in-page";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

/** The shared sign-in page for sellers and platform staff (see features/auth/sign-in-page.tsx). */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  return <SharedSignInPage searchParams={await searchParams} />;
}
