import { ICON_COMPONENTS } from "./registry";
import { parseIconValue, type IconName } from "./names";

/**
 * Inline SVG for an allowlisted library icon. Strokes use currentColor, so the caller colours it
 * with a text colour (theme colours on the storefront). Renders nothing for values that are not an
 * allowlisted `icon:<name>`: the SVG always comes from lucide-react, never from stored markup.
 */
export function IconGlyph({ value, name, label = "", className, strokeWidth = 1.5 }: { value?: string | null; name?: IconName; label?: string; className?: string; strokeWidth?: number }) {
  const key = name ?? parseIconValue(value);
  if (!key) return null;
  const Icon = ICON_COMPONENTS[key];
  return label ? <Icon role="img" aria-label={label} className={className} strokeWidth={strokeWidth} /> : <Icon aria-hidden focusable="false" className={className} strokeWidth={strokeWidth} />;
}
