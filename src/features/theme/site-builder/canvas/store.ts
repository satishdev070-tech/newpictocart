"use client";

import { useSyncExternalStore, type ReactNode } from "react";

/**
 * Canvas slot overrides (client only). When the site builder sends an unsaved theme, the bridge
 * renders the affected slots on the server (renderCanvasAction) and stores the returned nodes
 * here; each <CanvasSlot> shows its override instead of the server-rendered children.
 */

type Listener = () => void;
let overrides: Readonly<Record<string, ReactNode>> = {};
const listeners = new Set<Listener>();

export function setSlotOverrides(next: Record<string, ReactNode>) {
  overrides = { ...overrides, ...next };
  for (const l of listeners) l();
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const NONE = Symbol("none");

export function useSlotOverride(slot: string): ReactNode | typeof NONE {
  return useSyncExternalStore(
    subscribe,
    () => (slot in overrides ? overrides[slot] : NONE),
    () => NONE,
  );
}

export function isOverride(v: ReactNode | typeof NONE): v is ReactNode {
  return v !== NONE;
}
