/** Pure helpers for social posts (unit tested). */

/** Networks we publish to automatically (official APIs, OAuth or the seller's own token). */
export const SOCIAL_PLATFORMS = ["facebook", "instagram", "pinterest", "google", "linkedin"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
/**
 * Planned channels: on the calendar, never auto-published (no approved API access). When due, the
 * seller copies the caption and downloads the image, then marks the channel posted.
 */
export const MANUAL_CHANNELS = ["whatsapp", "x", "threads", "youtube"] as const;
export type ManualChannel = (typeof MANUAL_CHANNELS)[number];
export const ALL_CHANNELS = [...SOCIAL_PLATFORMS, ...MANUAL_CHANNELS] as const;
export type Channel = (typeof ALL_CHANNELS)[number];
export const CHANNEL_LABELS: Record<Channel, string> = { facebook: "Facebook", instagram: "Instagram", pinterest: "Pinterest", google: "Google Business", whatsapp: "WhatsApp", x: "X", linkedin: "LinkedIn", threads: "Threads", youtube: "YouTube" };
export const isAutoPlatform = (c: string): c is SocialPlatform => (SOCIAL_PLATFORMS as readonly string[]).includes(c);

/** "planned" = on the calendar at scheduled_at but never claimed by the publish cron. */
export type PostStatus = "draft" | "planned" | "scheduled" | "publishing" | "published" | "failed" | "cancelled";

export const CONTENT_PILLARS = ["product", "offer", "behind_scenes", "education", "customer", "festive", "announcement"] as const;
export type ContentPillar = (typeof CONTENT_PILLARS)[number];
export const PILLAR_LABELS: Record<ContentPillar, string> = { product: "Product", offer: "Offer", behind_scenes: "Behind the scenes", education: "How-to", customer: "Customer story", festive: "Festive", announcement: "Announcement" };
export type PlatformResult = { ok: boolean; id?: string; url?: string | null; error?: string; at: string };

/** Hashtags normalised to "#word" (letters, digits, underscore), unique, max 30 (Instagram's limit). */
export function normalizeHashtags(input: string | string[]): string[] {
  const raw = Array.isArray(input) ? input : input.split(/[\s,]+/);
  const out: string[] = [];
  for (const h of raw) {
    const tag = h.replace(/^#+/, "").replace(/[^\p{L}\p{M}\p{N}_]/gu, "");
    if (tag && !out.some((x) => x.toLowerCase() === `#${tag}`.toLowerCase())) out.push(`#${tag}`.slice(0, 60));
  }
  return out.slice(0, 30);
}

/** Where a post came from (social_posts.source). */
export const POST_SOURCES = ["manual", "ai", "auto_launch", "auto_product"] as const;
export type PostSource = (typeof POST_SOURCES)[number];
export const SOURCE_LABELS: Record<PostSource, string> = { manual: "Manual", ai: "AI", auto_launch: "Auto · store launch", auto_product: "Auto · new product" };

/** Networks that can carry their own text (social_posts.variants), e.g. written by AI per network. */
export const VARIANT_CHANNELS = ["facebook", "instagram", "linkedin", "whatsapp"] as const;
export type VariantChannel = (typeof VARIANT_CHANNELS)[number];
export type PostVariants = Partial<Record<VariantChannel, string>>;
/** Hard limits per network for the per-network text. */
export const VARIANT_LIMITS: Record<VariantChannel, number> = { facebook: 5000, instagram: 2200, linkedin: 3000, whatsapp: 1000 };

/** Cleans stored/untrusted variants: known channels, trimmed strings within the limit, empty dropped. */
export function parseVariants(raw: unknown): PostVariants {
  const out: PostVariants = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const c of VARIANT_CHANNELS) {
    const v = (raw as Record<string, unknown>)[c];
    if (typeof v === "string" && v.trim()) out[c] = v.trim().slice(0, VARIANT_LIMITS[c]);
  }
  return out;
}

const LIMIT: Record<SocialPlatform, number> = { facebook: 5000, instagram: 2200, pinterest: 800, google: 1500, linkedin: 3000 };

/**
 * Final text for a platform: the network's own text (variant) or the shared caption, then the link
 * (Facebook and LinkedIn; Instagram captions can't hold links, Pinterest/Google carry it separately),
 * then hashtags (not Pinterest; LinkedIn keeps at most 5).
 */
export function composeText(p: { caption: string; hashtags: string[]; link: string | null; variants?: PostVariants }, platform: SocialPlatform): string {
  const own = platform in (p.variants ?? {}) ? p.variants?.[platform as VariantChannel] : undefined;
  const parts = [(own ?? p.caption).trim()];
  if (p.link && (platform === "facebook" || platform === "linkedin") && !parts[0]!.includes(p.link)) parts.push(p.link);
  const tags = platform === "linkedin" ? p.hashtags.slice(0, 5) : p.hashtags;
  if (tags.length && platform !== "pinterest") parts.push(tags.join(" "));
  return parts.filter(Boolean).join("\n\n").slice(0, LIMIT[platform]);
}

/** Text for an assisted WhatsApp share: its own text (or the caption), then the link. */
export function whatsappText(p: { caption: string; link: string | null; variants?: PostVariants }): string {
  const body = (p.variants?.whatsapp ?? p.caption).trim();
  return [body, p.link && !body.includes(p.link) ? p.link : ""].filter(Boolean).join("\n\n").slice(0, VARIANT_LIMITS.whatsapp + 600);
}

/** wa.me share link: opens WhatsApp with the text ready to send to a chat, group, Status or Channel. */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Overall status from per-platform results, counting only auto-published networks (planned/manual
 * channels never have results): published if any succeeded, failed if none did.
 */
export function overallStatus(platforms: readonly string[], results: Partial<Record<SocialPlatform, PlatformResult>>): "published" | "failed" {
  return platforms.filter(isAutoPlatform).some((p) => results[p]?.ok) ? "published" : "failed";
}
