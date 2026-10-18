/**
 * Placement of the on-canvas section chrome (pure; viewport px). Used by canvas-bridge.tsx.
 */

export type Rect = { top: number; left: number; width: number; height: number };

/** Gap kept between the chrome and the viewport / section edges. */
export const EDGE = 8;
/** Offset of the toolbar from the section top (clears the "+ / Add with AI" cluster on the edge). */
export const TOOLBAR_INSET = 28;

/**
 * Top of the section toolbar.
 *  - Inside the section, near its top; pushed down below a visible store header (`minTop`) and kept
 *    inside the section and the viewport while it scrolls.
 *  - Below the section when it is the header itself, or too short to hold the toolbar.
 *  - Above it when there is no room below.
 */
export function toolbarTop({ box, toolbarHeight, viewportHeight, minTop = 0, inHeader = false }: { box: Rect; toolbarHeight: number; viewportHeight: number; minTop?: number; inHeader?: boolean }): number {
  const bottom = box.top + box.height;
  const maxTop = viewportHeight - toolbarHeight - EDGE;
  const below = bottom + EDGE;
  const above = box.top - toolbarHeight - EDGE;
  const outside = () => (below <= maxTop ? below : above >= Math.max(EDGE, minTop) ? above : Math.max(EDGE, Math.min(box.top + EDGE, maxTop)));
  if (inHeader || box.height < toolbarHeight + TOOLBAR_INSET + EDGE) return outside();
  const floor = Math.max(minTop + EDGE, EDGE);
  const desired = Math.max(box.top + TOOLBAR_INSET, floor);
  // Scrolled past: the section bottom no longer leaves room inside → sit below it (or above).
  const insideMax = Math.min(bottom - toolbarHeight - EDGE, maxTop);
  if (insideMax < floor) return outside();
  return Math.min(desired, insideMax);
}

/** Left edge of an element `width` px wide centred on the box, kept inside the viewport. */
export function centeredLeft(box: Rect, width: number, viewportWidth: number): number {
  const ideal = box.left + box.width / 2 - width / 2;
  return Math.max(EDGE, Math.min(ideal, viewportWidth - width - EDGE));
}

/**
 * Bottom edge of the store header when it is on screen at the top of the viewport (a sticky or
 * not-yet-scrolled header), else 0. The toolbar of other sections stays below it.
 */
export function headerFloor(header: Rect | null): number {
  if (!header) return 0;
  const bottom = header.top + header.height;
  return header.top <= EDGE && bottom > 0 ? bottom : 0;
}

/** Whether the ⋮ menu (about `menuHeight` px tall) should open upwards from a toolbar at `top`. */
export function menuOpensUp(top: number, toolbarHeight: number, menuHeight: number, viewportHeight: number): boolean {
  return top + toolbarHeight + menuHeight + EDGE > viewportHeight && top - menuHeight - EDGE >= 0;
}
