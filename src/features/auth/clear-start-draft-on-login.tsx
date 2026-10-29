"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearStartDraftStorage } from "@/features/start/draft/storage";

/**
 * Wipe /start cookie+LS when a Login page opens so returning users don't resume a stale draft.
 * When already signed in, clear first then client-redirect (server redirect would skip the clear).
 */
export function ClearStartDraftOnLogin({ signedInLanding }: { signedInLanding?: string | null }) {
  const router = useRouter();
  useEffect(() => {
    clearStartDraftStorage();
    if (signedInLanding) router.replace(signedInLanding);
  }, [signedInLanding, router]);
  return null;
}
