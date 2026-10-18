import "server-only";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { serverEnv } from "@/lib/env/server";
import { logger } from "@/lib/observability/logger";
import { activeIntegration } from "@/features/integrations/server/store";
import { ALL_STOREFRONTS_TAG, storefrontTag } from "@/lib/cache/storefront";

/**
 * Latest posts of a store's connected Instagram professional account, for the storefront's
 * Instagram section (SocialProof with source "instagram").
 *
 * - Tenant id comes from the caller's verified host (RenderContext), never from the request.
 * - The Page token stays on the server: it is read from the encrypted integration (ADR-030) and
 *   only the PUBLIC media fields leave this module (ADR-006 addition 2026-10-18).
 * - One Graph request per store per hour at most (Data Cache, keyed by tenant id; off in development).
 * - Every value is validated: https media on Instagram / Facebook CDNs, permalinks on instagram.com.
 *   Any failure (not connected, expired token, Graph error) returns null and the section falls back
 *   to the posts the seller added by hand.
 */

export type InstagramMedia = {
  id: string;
  /** Image (photo, first album image or video cover) on the Instagram CDN. */
  imageUrl: string;
  permalink: string;
  isVideo: boolean;
  /** First line of the caption (plain text, trimmed), used as alt text. */
  caption: string;
};
export type InstagramFeed = { username: string | null; media: InstagramMedia[] };

const FEED_SECONDS = 60 * 60;
const MEDIA_HOSTS = ["cdninstagram.com", "fbcdn.net"];

const onHost = (value: string, hosts: string[]) => {
  try {
    const u = new URL(value);
    const h = u.hostname.toLowerCase();
    return u.protocol === "https:" && !u.username && !u.password && hosts.some((x) => h === x || h.endsWith(`.${x}`));
  } catch {
    return false;
  }
};
const mediaUrl = z.string().max(2000).refine((v) => onHost(v, MEDIA_HOSTS));
const permalink = z.string().max(300).refine((v) => onHost(v, ["instagram.com"]));

const graphMedia = z.object({
  id: z.string().regex(/^\d{1,30}$/),
  media_type: z.enum(["IMAGE", "VIDEO", "CAROUSEL_ALBUM"]).catch("IMAGE"),
  media_url: mediaUrl.optional().catch(undefined),
  thumbnail_url: mediaUrl.optional().catch(undefined),
  permalink: permalink.optional().catch(undefined),
  caption: z.string().optional().catch(undefined),
});

/** Graph response → validated public media (pure; exported for tests). */
export function parseInstagramMedia(json: unknown, limit = 12): InstagramMedia[] {
  const data = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  const out: InstagramMedia[] = [];
  for (const raw of data) {
    const r = graphMedia.safeParse(raw);
    if (!r.success) continue;
    const m = r.data;
    const isVideo = m.media_type === "VIDEO";
    const imageUrl = isVideo ? m.thumbnail_url : (m.media_url ?? m.thumbnail_url);
    if (!imageUrl || !m.permalink) continue;
    const caption = (m.caption ?? "").split("\n")[0]!.replace(/\s+/g, " ").trim().slice(0, 140);
    out.push({ id: m.id, imageUrl, permalink: m.permalink, isVideo, caption });
    if (out.length >= limit) break;
  }
  return out;
}

async function load(tenantId: string): Promise<InstagramFeed | null> {
  const it = await activeIntegration(tenantId, "instagram");
  const igId = it?.public.account_id;
  const token = it?.secrets.page_token;
  if (!igId || !/^\d{1,30}$/.test(igId) || !token) return null;
  try {
    const params = new URLSearchParams({ fields: "id,media_type,media_url,thumbnail_url,permalink,caption", limit: "12", access_token: token });
    const res = await fetch(`https://graph.facebook.com/${serverEnv().META_GRAPH_VERSION}/${igId}/media?${params}`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) {
      logger.warn("instagram_feed.http", { tenantId, status: res.status });
      return null;
    }
    const media = parseInstagramMedia(await res.json());
    const name = it.public.account_name ?? "";
    return { username: /^@[A-Za-z0-9._]{1,30}$/.test(name) ? name : null, media };
  } catch (err) {
    logger.warn("instagram_feed.failed", { tenantId, error: err instanceof Error ? err.message : "unknown" });
    return null;
  }
}

const cached = (tenantId: string) => unstable_cache(load, ["sf", "instagram-feed"], { tags: [ALL_STOREFRONTS_TAG, storefrontTag(tenantId)], revalidate: FEED_SECONDS })(tenantId);

/** The store's latest Instagram posts, or null when Instagram isn't connected / available. */
export function getInstagramFeed(tenantId: string): Promise<InstagramFeed | null> {
  return process.env.NODE_ENV === "production" ? cached(tenantId) : load(tenantId);
}
