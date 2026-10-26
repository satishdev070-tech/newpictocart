"use client";

import { createContext, useContext, type ReactNode } from "react";

type Scope = { sectionType?: string; variant?: string };

const Ctx = createContext<Scope | null>(null);

/**
 * Tells image fields below which section (and layout variant) they belong to, so the picker can use
 * the right image standard. Without it, fields fall back to a guess from their key and label.
 */
export function ImageSlotProvider({ sectionType, variant, children }: Scope & { children: ReactNode }) {
  return <Ctx.Provider value={{ sectionType, variant }}>{children}</Ctx.Provider>;
}

export function useImageSlot(): Scope | null {
  return useContext(Ctx);
}
