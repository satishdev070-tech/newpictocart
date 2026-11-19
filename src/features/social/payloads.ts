/**
 * Pure request builders for the social desk (unit tested; no I/O, no secrets).
 *
 * LinkedIn (Posts API, versioned REST, docs: learn.microsoft.com/linkedin/marketing/community-management/shares/posts-api):
 *   commentary uses "little text" format: the characters \ | { } @ [ ] ( ) < > # * _ ~ are
 *   reserved and must be escaped, hashtags are written as {hashtag|\#|tag}.
 */

/** LinkedIn author URN from a member id (OpenID `sub`) or an organization id. */
export function linkedinAuthorUrn(kind: "person" | "organization", id: string): string | null {
  const clean = id.trim();
  if (kind === "organization") return /^[0-9]{1,20}$/.test(clean) ? `urn:li:organization:${clean}` : null;
  return /^[A-Za-z0-9_-]{1,100}$/.test(clean) ? `urn:li:person:${clean}` : null;
}

const RESERVED = /[\\|{}@[\]()<>#*_~]/g;

/** Escapes little-text reserved characters and turns #words into LinkedIn hashtag templates. */
export function linkedinCommentary(text: string): string {
  const out: string[] = [];
  // Split on hashtags (Unicode letters/digits/underscore after #), keep everything else escaped.
  const re = /#([\p{L}\p{M}\p{N}_]+)/gu;
  let last = 0;
  for (const m of text.matchAll(re)) {
    out.push(text.slice(last, m.index).replace(RESERVED, (c) => `\\${c}`));
    out.push(`{hashtag|\\#|${m[1]!.replace(RESERVED, (c) => `\\${c}`)}}`);
    last = m.index! + m[0].length;
  }
  out.push(text.slice(last).replace(RESERVED, (c) => `\\${c}`));
  return out.join("").slice(0, 3000);
}

export type LinkedInPostBody = {
  author: string;
  commentary: string;
  visibility: "PUBLIC";
  distribution: { feedDistribution: "MAIN_FEED"; targetEntities: []; thirdPartyDistributionChannels: [] };
  content?: { media: { id: string; altText: string } };
  lifecycleState: "PUBLISHED";
  isReshareDisabledByAuthor: false;
};

/** POST /rest/posts body: a text post, or an image post when an image URN was uploaded first. */
export function linkedinPostBody(author: string, text: string, image?: { urn: string; altText: string } | null): LinkedInPostBody {
  return {
    author,
    commentary: linkedinCommentary(text),
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    ...(image ? { content: { media: { id: image.urn, altText: image.altText.slice(0, 300) } } } : {}),
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };
}

/** Public URL of a LinkedIn post from its URN (x-restli-id header). */
export function linkedinPostUrl(urn: string | null): string | null {
  return urn && /^urn:li:(share|ugcPost|activity):[0-9]+$/.test(urn) ? `https://www.linkedin.com/feed/update/${urn}/` : null;
}

/** Headers for LinkedIn's versioned REST API. */
export function linkedinHeaders(token: string, version: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "LinkedIn-Version": version, "X-Restli-Protocol-Version": "2.0.0", "Content-Type": "application/json" };
}

/** What kind of Meta token the seller pasted, from GET /me?fields=id,name,category (Pages have a category). */
export function metaTokenKind(me: Record<string, unknown>): "page" | "user" | null {
  if (typeof me.id !== "string") return null;
  return typeof me.category === "string" ? "page" : "user";
}

/** Manual connect inputs are ids only: digits for Meta Page/IG ids and LinkedIn organizations. */
export const META_ID_RE = /^[0-9]{5,25}$/;
