"use client";

import { useCallback, useEffect, useState } from "react";
import { EMPTY_DRAFT, INFO_DRAFT_KEY, parseDraft, type InformativeDraft } from "../draft";

/** The informative onboarding draft in localStorage (own key; never touches the store journey's draft). */
export function useInformativeDraft() {
  const [draft, setDraftState] = useState<InformativeDraft>(EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(INFO_DRAFT_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from storage
      if (raw) setDraftState(parseDraft(JSON.parse(raw)));
    } catch {
      // Private mode / blocked storage: start empty.
    }
    setHydrated(true);
  }, []);

  const setDraft = useCallback((next: InformativeDraft | ((d: InformativeDraft) => InformativeDraft)) => {
    setDraftState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      try {
        window.localStorage.setItem(INFO_DRAFT_KEY, JSON.stringify(value));
      } catch {
        // Quota / private mode: keep it in memory.
      }
      return value;
    });
  }, []);

  return { draft, setDraft, hydrated };
}

export function clearInformativeDraft(): void {
  try {
    window.localStorage.removeItem(INFO_DRAFT_KEY);
  } catch {
    // ignore
  }
}
