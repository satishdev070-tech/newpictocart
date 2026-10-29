"use client";

import { useEffect } from "react";
import { clearStartDraftStorage } from "@/features/start/draft/storage";

/** Wipe /start cookie+LS when a Login page opens so returning users don't resume a stale draft. */
export function ClearStartDraftOnLogin() {
  useEffect(() => {
    clearStartDraftStorage();
  }, []);
  return null;
}
