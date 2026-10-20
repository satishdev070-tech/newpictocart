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

function freshDraft(initial: Initial): StartDraft {
  return emptyStartDraft({ plan: initial.plan ?? null, theme: initial.theme ?? null });
}

function loadDraft(initial: Initial): StartDraft {
  try {
    const raw = readStartDraftRaw();
    let next = null as ReturnType<typeof parseStartDraft>;
    if (raw) {
      try {
        next = parseStartDraft(JSON.parse(raw));
      } catch {
        next = null;
      }
    }
    if (!next) return freshDraft(initial);
    if (!next.plan && initial.plan) next = { ...next, plan: initial.plan };
    if (!next.theme && initial.theme) next = { ...next, theme: initial.theme };
    return next;
  } catch {
    return freshDraft(initial);
  }
}

function getClientSnapshot(initial: Initial): StartDraft {
  const key = keyOf(initial);
  if (clientSnapshot && clientKey === key) return clientSnapshot;
  try {
    clientSnapshot = loadDraft(initial);
  } catch {
    clientSnapshot = freshDraft(initial);
  }
  clientKey = key;
  return clientSnapshot;
}

function getServerSnapshot(initial: Initial): StartDraft {
  const key = keyOf(initial);
  const existing = serverSnapshots.get(key);
  if (existing) return existing;
  const created = freshDraft(initial);
  serverSnapshots.set(key, created);
  return created;
}

function emptySubscribe() {
  return () => undefined;
}

/**
 * True after hydration. The welcome shell paints from the server snapshot immediately;
 * this flag only gates redirects and store finalization so they wait for the saved draft.
 */
function useClientReady(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

export function useStartDraft(initial: Initial) {
  const plan = initial.plan;
  const theme = initial.theme;
  const snapshotInitial = { plan, theme };
  const hydrated = useClientReady();
  const draft = useSyncExternalStore(
    subscribe,
    () => getClientSnapshot(snapshotInitial),
    () => getServerSnapshot(snapshotInitial),
  );

  const setDraft = useCallback((updater: StartDraft | ((prev: StartDraft) => StartDraft)) => {
    const current = { plan, theme };
    const key = keyOf(current);
    const prev = clientSnapshot && clientKey === key ? clientSnapshot : getClientSnapshot(current);
    const next = typeof updater === "function" ? updater(prev) : updater;
    clientSnapshot = next;
    clientKey = key;
    writeStartDraft(next);
  }, [plan, theme]);

  const patchDraft = useCallback(
    (patch: Partial<StartDraft>) => {
      setDraft((prev) => ({ ...prev, ...patch }));
    },
    [setDraft],
  );

  return { draft, setDraft, patchDraft, hydrated };
}
