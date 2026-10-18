/**
 * Curated icon library for image fields (media picker "Icons" tab). A theme value `icon:<name>`
 * is accepted ONLY for the names listed here (see imagePath in theme/schema/primitives.ts) and is
 * rendered from the matching lucide-react component (lib/icons/registry.tsx), never from seller
 * markup. Pure module: no React, safe for zod schemas on client and server.
 * Generated list; keep names unique and in sync with ICON_COMPONENTS (the type enforces it).
 */

export const ICON_CATEGORIES = [
  { id: "commerce", label: "Shopping", icons: ["shopping-cart", "shopping-bag", "shopping-basket", "store", "tag", "tags", "percent", "badge-percent", "indian-rupee", "badge-indian-rupee", "receipt", "credit-card", "wallet", "banknote", "coins", "hand-coins", "piggy-bank", "gift", "package", "package-check", "box", "boxes", "barcode", "qr-code", "ticket", "calculator", "scale"] },
  { id: "shipping", label: "Shipping & returns", icons: ["truck", "truck-electric", "plane", "ship", "car", "bike", "map-pin", "map", "compass", "navigation", "route", "globe", "warehouse", "container", "timer", "clock", "calendar", "calendar-check", "rotate-ccw", "undo-2", "refresh-cw"] },
  { id: "trust", label: "Trust & quality", icons: ["shield-check", "shield", "lock", "badge-check", "award", "medal", "trophy", "crown", "thumbs-up", "star", "heart", "hand-heart", "handshake", "check", "circle-check", "sparkles", "gem", "diamond", "infinity", "key"] },
  { id: "support", label: "Support & contact", icons: ["headphones", "headset", "phone", "mail", "message-circle", "message-square", "send", "at-sign", "info", "circle-help", "bell", "megaphone", "users", "user", "smile", "quote", "life-buoy"] },
  { id: "social", label: "Social & media", icons: ["share-2", "link", "rss", "hash", "camera", "video", "image", "music", "play", "circle-play", "mic", "podcast", "tv", "radio"] },
  { id: "nature", label: "Nature & eco", icons: ["leaf", "sprout", "recycle", "flower", "flower-2", "trees", "tree-pine", "mountain", "sun", "moon", "cloud", "umbrella", "snowflake", "droplet", "droplets", "waves", "wind", "flame", "zap", "thermometer"] },
  { id: "food", label: "Food & drink", icons: ["coffee", "pizza", "utensils", "apple", "cake-slice", "wine", "beer", "cookie", "croissant", "salad", "soup", "egg", "fish", "carrot", "cherry", "citrus", "grape", "milk", "ice-cream-cone", "sandwich", "candy"] },
  { id: "lifestyle", label: "Fashion, beauty & home", icons: ["shirt", "watch", "glasses", "footprints", "backpack", "briefcase", "scissors", "ribbon", "palette", "brush", "paintbrush", "spray-can", "sparkle", "wand-sparkles", "lamp", "sofa", "bed", "bath", "baby", "dog", "cat"] },
  { id: "tech", label: "Tech, health & tools", icons: ["smartphone", "laptop", "monitor", "gamepad-2", "battery-charging", "plug", "lightbulb", "wifi", "dumbbell", "pill", "stethoscope", "syringe", "heart-pulse", "scan-heart", "hammer", "wrench", "ruler", "weight"] },
  { id: "ui", label: "Interface", icons: ["search", "house", "settings", "plus", "minus", "x", "arrow-right", "arrow-up-right", "chevron-right", "eye", "bookmark", "book-open", "feather", "target", "rocket", "party-popper", "factory", "hourglass"] },
] as const;

export type IconCategoryId = (typeof ICON_CATEGORIES)[number]["id"];
export type IconName = (typeof ICON_CATEGORIES)[number]["icons"][number];

export const ICON_NAMES: readonly IconName[] = ICON_CATEGORIES.flatMap((c) => c.icons);
const NAME_SET: ReadonlySet<string> = new Set(ICON_NAMES);

export const ICON_PREFIX = "icon:";
/** Exact shape of a stored icon reference; membership in the allowlist is checked separately. */
export const ICON_VALUE_RE = /^icon:[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isIconName(name: string): name is IconName {
  return NAME_SET.has(name);
}

/** The allowlisted icon name in an `icon:<name>` value, else null (storage paths, unknown names, junk). */
export function parseIconValue(value: string | null | undefined): IconName | null {
  if (!value || value.length > 60 || !ICON_VALUE_RE.test(value)) return null;
  const name = value.slice(ICON_PREFIX.length);
  return isIconName(name) ? name : null;
}

export function iconValue(name: IconName): string {
  return `${ICON_PREFIX}${name}`;
}

/** Human label: "shopping-cart" -> "Shopping cart". */
export function iconLabel(name: string): string {
  const s = name.replace(/-(\d+)$/, "").replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
