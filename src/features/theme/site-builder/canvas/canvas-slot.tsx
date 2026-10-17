"use client";

import type { ReactNode } from "react";
import { isOverride, useSlotOverride } from "./store";

/** One editable list of sections on the canvas (header group, a template part, a custom page...). */
export function CanvasSlot({ slot, children }: { slot: string; children: ReactNode }) {
  const override = useSlotOverride(slot);
  return (
    <div className="contents" data-builder-slot={slot}>
      {isOverride(override) ? override : children}
    </div>
  );
}
