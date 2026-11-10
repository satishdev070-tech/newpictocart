/** Popover placement next to a highlighted target (pure, unit tested). */

export type Rect = { top: number; left: number; width: number; height: number };
export type Placement = { top: number; left: number; side: "bottom" | "top" | "right" | "left" | "center" | "sheet" };

const GAP = 12;
const MARGIN = 12;
/** Below this width the popover docks to the bottom of the screen like a sheet. */
export const SHEET_BELOW = 640;

export function placePopover(target: Rect | null, pop: { width: number; height: number }, vp: { width: number; height: number }): Placement {
  if (vp.width < SHEET_BELOW) return { top: vp.height - pop.height - MARGIN, left: MARGIN, side: "sheet" };
  if (!target) return { top: Math.max(MARGIN, (vp.height - pop.height) / 2), left: Math.max(MARGIN, (vp.width - pop.width) / 2), side: "center" };
  const clampX = (x: number) => Math.min(Math.max(MARGIN, x), vp.width - pop.width - MARGIN);
  const clampY = (y: number) => Math.min(Math.max(MARGIN, y), vp.height - pop.height - MARGIN);
  const below = target.top + target.height + GAP;
  if (below + pop.height <= vp.height - MARGIN) return { top: below, left: clampX(target.left), side: "bottom" };
  const above = target.top - GAP - pop.height;
  if (above >= MARGIN) return { top: above, left: clampX(target.left), side: "top" };
  const right = target.left + target.width + GAP;
  if (right + pop.width <= vp.width - MARGIN) return { top: clampY(target.top), left: right, side: "right" };
  const left = target.left - GAP - pop.width;
  if (left >= MARGIN) return { top: clampY(target.top), left, side: "left" };
  // Target fills the screen: float over its lower part.
  return { top: clampY(vp.height - pop.height - MARGIN), left: clampX(target.left), side: "bottom" };
}
