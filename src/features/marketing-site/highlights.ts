/**
 * Heading colour highlights ("Now {purple:what to sell}"). Zod-free on purpose: the marketing chrome
 * (landing icons, mega menu, mobile nav) renders these in the browser, and importing landing.ts there
 * shipped its zod schemas to every visitor. landing.ts re-exports everything here.
 */

export const HIGHLIGHT_COLORS = ["purple", "green", "orange", "indigo"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export type HighlightPart = { text: string; color: HighlightColor | null };

const HIGHLIGHT_RE = /\{(purple|green|orange|indigo):([^{}]+)\}/g;

/** "Now {purple:what to sell}" → [{text:"Now ",color:null},{text:"what to sell",color:"purple"}]. */
export function parseHighlights(text: string): HighlightPart[] {
  const parts: HighlightPart[] = [];
  let last = 0;
  for (const m of text.matchAll(HIGHLIGHT_RE)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), color: null });
    parts.push({ text: m[2]!, color: m[1] as HighlightColor });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), color: null });
  return parts;
}

/** Plain text of a highlighted heading (for meta tags, aria labels). */
export const stripHighlights = (text: string) => parseHighlights(text).map((p) => p.text).join("");
