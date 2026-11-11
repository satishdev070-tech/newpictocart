import { INTERNAL_HOST_HEADER } from "@/lib/tenant/routing";
import { GSC_CONTENT_TYPE, GSC_FILENAME_RE, gscDomainForHost } from "@/features/search-console/verification";
import { findGscFileContent } from "@/features/search-console/server/store";

/**
 * Public Google Search Console verification file. Reached via the proxy's rewrite of
 * `/googleXXXXXXXXXXXXXXXX.html` on the platform's apex/www hosts (src/proxy.ts).
 *
 * The host is the proxy-verified one (`x-paliya-host`; client copies are stripped by the
 * proxy), never a client-forwarded header. Only hosts on a managed domain's fixed allowlist are
 * served, so store subdomains and custom domains always 404, even via this /api path directly.
 * Body is exactly the stored content: no layout, scripts, redirects, cookies or auth.
 */

const NOT_FOUND_HEADERS = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const domain = gscDomainForHost(request.headers.get(INTERNAL_HOST_HEADER));
  if (!domain || !GSC_FILENAME_RE.test(file)) return new Response("Not found", { status: 404, headers: NOT_FOUND_HEADERS });
  const content = await findGscFileContent(domain, file);
  if (content === null) return new Response("Not found", { status: 404, headers: NOT_FOUND_HEADERS });
  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": GSC_CONTENT_TYPE,
      // Short shared cache: replace/remove take effect within a minute; Google re-checks periodically.
      "Cache-Control": "public, max-age=60",
      "X-Robots-Tag": "noindex",
    },
  });
}
