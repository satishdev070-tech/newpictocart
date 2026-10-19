"use client";

import { useCallback, useSyncExternalStore } from "react";
import { emptyStartDraft, parseStartDraft, type StartDraft } from "./schema";
import { readStartDraftRaw, subscribeStartDraft, writeStartDraft } from "./storage";

type Initial = { plan?: string | null; theme?: string | null };

let clientSnapshot: StartDraft | null = null;
let clientKey = "";

const serverSnapshots = new Map<string, StartDraft>();

function keyOf(initial: Initial): string {
  return `${initial.plan ?? ""}|${initial.theme ?? ""}`;
}

function subscribe(listener: () => void) {
  return subscribeStartDraft(() => {
    clientSnapshot = null;
    clientKey = "";
    listener();
  });
}

function loadDraft(initial: Initial): StartDraft {
  const raw = readStartDraftRaw();
  let next = null as ReturnType<typeof parseStartDraft>;
  if (raw) {
    try {
      next = parseStartDraft(JSON.parse(raw));
    } catch {
      next = null;
    }
  }
  if (!next) return emptyStartDraft({ plan: initial.plan ?? null, theme: initial.theme ?? null });
  if (!next.plan && initial.plan) next = { ...next, plan: initial.plan };
  if (!next.theme && initial.theme) next = { ...next, theme: initial.theme };
  return next;
}

function getClientSnapshot(initial: Initial): StartDraft {
  const key = keyOf(initial);
  if (clientSnapshot && clientKey === key) return clientSnapshot;
  clientSnapshot = loadDraft(initial);
  clientKey = key;
  return clientSnapshot;
}

function getServerSnapshot(initial: Initial): StartDraft {
  const key = keyOf(initial);
  const existing = serverSnapshots.get(key);
  if (existing) return existing;
  const created = emptyStartDraft({ plan: initial.plan ?? null, theme: initial.theme ?? null });
  serverSnapshots.set(key, created);
  return created;
}

function emptySubscribe() {
  return () => undefined;
}

/** True only after hydration, so the server and the first client render stay in sync. */
function useHydrated(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

export function useStartDraft(initial: Initial) {
  const hydrated = useHydrated();
  const live = useSyncExternalStore(subscribe, () => getClientSnapshot(initial), () => getServerSnapshot(initial));
  const draft = hydrated ? live : null;

  const setDraft = useCallback((updater: StartDraft | ((prev: StartDraft) => StartDraft)) => {
    const prev = clientSnapshot;
    if (!prev) return;
    const next = typeof updater === "function" ? updater(prev) : updater;
    clientSnapshot = next;
    writeStartDraft(next);
  }, []);

  const patchDraft = useCallback(
    (patch: Partial<StartDraft>) => {
      setDraft((prev) => ({ ...prev, ...patch }));
    },
    [setDraft],
  );

  return { draft, setDraft, patchDraft, hydrated };
}
