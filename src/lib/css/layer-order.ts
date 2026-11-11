/**
 * Cascade-layer order guard shared by the unit test (source CSS) and the Worker build check
 * (emitted CSS).
 *
 * Browsers fix the order of cascade layers by FIRST APPEARANCE across every stylesheet on the
 * page, and the vinext/Vite Worker build does not promise that Tailwind's globals.css is linked
 * first. A stylesheet that opens with `@layer components { … }` and loads before globals.css
 * declares `components` ahead of `base`, so Tailwind preflight (`*{margin:0;padding:0}`,
 * transparent buttons) beats every component rule. That is what broke storefront layout on
 * production in November 2026 (docs/IMPLEMENTATION_STATUS.md).
 *
 * Rule: the Tailwind layers a stylesheet mentions, in order of first appearance, must be a PREFIX
 * of Tailwind's order (properties, theme, base, …). Source files get there by starting with the
 * full `@layer properties, theme, base, components, utilities;` statement; minifiers may drop
 * trailing names a file never uses, which is still safe because later files append them in
 * order. Then the order is right whichever file the browser sees first.
 */

export const TAILWIND_LAYER_ORDER = ["properties", "theme", "base", "components", "utilities"] as const;

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Tailwind layer names in the order this stylesheet first mentions them (top-level only). */
export function layerFirstAppearance(css: string): string[] {
  const src = stripComments(css);
  const seen: string[] = [];
  const known = new Set<string>(TAILWIND_LAYER_ORDER);
  let depth = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth = Math.max(0, depth - 1);
    else if (ch === "@" && depth === 0 && src.startsWith("@layer", i)) {
      const m = /^@layer\s*([^{;]*)[{;]/.exec(src.slice(i));
      if (!m) continue;
      for (const raw of (m[1] ?? "").split(",")) {
        const name = raw.trim().split(".")[0] ?? "";
        if (name && known.has(name) && !seen.includes(name)) seen.push(name);
      }
    }
  }
  return seen;
}

/** Null when the stylesheet is safe in any load order; otherwise a human-readable reason. */
export function layerOrderViolation(css: string): string | null {
  const seen = layerFirstAppearance(css);
  if (seen.length === 0) return null;
  const expected = TAILWIND_LAYER_ORDER.join(", ");
  if (seen.every((name, i) => name === TAILWIND_LAYER_ORDER[i])) return null;
  return `layers first appear as [${seen.join(", ")}]; start the file with \`@layer ${expected};\``;
}
