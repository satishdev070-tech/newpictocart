/**
 * Layout-card wireframes for variant values added by the design-variants work (group a).
 * Boxes: [x, y, w, h, kind?] on a 40x24 grid; "t" = a text line. Keys are variant VALUES and must
 * not collide with other groups (prefix new values with the section, e.g. "faq-cards").
 */
export type DiagramBox = [number, number, number, number, ("img" | "t")?];
export const DIAGRAMS_A: Record<string, DiagramBox[]> = {};
