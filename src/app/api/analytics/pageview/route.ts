import { INTERNAL_HOST_HEADER } from "@/lib/tenant/routing";
import { normalizeHost } from "@/lib/tenant/host";
import { MAX_BEACON_BYTES, parsePageview } from "@/features/platform-analytics/pageview";
import { recordPageview } from "@/features/platform-analytics/server/ingest";

/**
 * First-party page-view beacon (navigator.sendBeacon from platform pages). Always answers 204
 * so the response reveals nothing; the host is the proxy-verified one, never a client header.
 */
const NO_CONTENT = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const len = Number(request.headers.get("content-length") ?? "0");
  if (len > MAX_BEACON_BYTES) return NO_CONTENT();
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BEACON_BYTES) return NO_CONTENT();
    body = JSON.parse(text);
  } catch {
    return NO_CONTENT();
  }
  const view = parsePageview(body);
  if (view) await recordPageview(normalizeHost(request.headers.get(INTERNAL_HOST_HEADER)), view);
  return NO_CONTENT();
}
