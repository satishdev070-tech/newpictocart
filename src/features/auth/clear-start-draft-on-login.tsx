"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearStartDraftStorage } from "@/features/start/draft/storage";

/**
 * Wipe /start cookie+LS when the Login form opens so returning users don't resume a stale draft.
 * Panel bounce for already-signed-in users is a **server** `redirect()` in `SharedSignInPage`
 * (with `clearStartDraftCookieServer`); `signedInLanding` remains only as a rare client fallback.
 */
export function ClearStartDraftOnLogin({ signedInLanding }: { signedInLanding?: string | null }) {
  const router = useRouter();
  useEffect(() => {
    clearStartDraftStorage();
    if (signedInLanding) router.replace(signedInLanding);
  }, [signedInLanding, router]);
  return null;
}
