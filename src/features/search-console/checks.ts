import { DNS_RCODE, dohQuery, txtValues, type DohResponse } from "@/features/domains/dns";
import { evaluateGscDelivery, type GscDeliveryResult, type GscDnsStatus } from "./verification";

/**
 * On-demand checks (never run while the admin page renders). Both take an injectable fetch,
 * have hard timeouts and never throw.
 */

/** TXT at the apex contains the stored value (exact) → found; no such record → not_found; DoH failure → failed. */
export function evaluateGscDns(apex: string, value: string, resp: DohResponse | null): GscDnsStatus {
  if (!resp) return "failed";
  if (resp.Status === DNS_RCODE.NXDOMAIN) return "not_found";
  if (resp.Status !== DNS_RCODE.NOERROR) return "failed";
  return txtValues(resp, apex).includes(value) ? "found" : "not_found";
}

const MAX_BODY_CHARS = 16 * 1024;

/**
 * Fetches the public verification URL the way a crawler would: no cookies, no redirects
 * followed, no cache. Note: on Cloudflare a Worker fetching its own custom domain can be
 * refused by the platform; that surfaces as "Delivery failed: could not reach", and the admin
 * can still use "Test URL" in the browser.
 */
export async function runGscDeliveryCheck(url: string, expected: string, opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}): Promise<GscDeliveryResult> {
  try {
    const res = await (opts.fetchImpl ?? fetch)(url, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      headers: { "user-agent": "PictocartSearchConsoleCheck/1.0", accept: "text/html" },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
    });
    const body = (await res.text()).slice(0, MAX_BODY_CHARS);
    return evaluateGscDelivery({ status: res.status, contentType: res.headers.get("content-type"), body }, expected);
  } catch {
    return { ok: false, reason: "Could not reach the URL from the server (timeout or network error). Open it with Test URL to check in your browser." };
  }
}

/** DNS-over-HTTPS TXT lookup at the apex (Cloudflare resolver; works on Workers). */
export async function runGscDnsCheck(apex: string, value: string, opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}): Promise<GscDnsStatus> {
  const resp = await dohQuery(apex, "TXT", opts);
  return evaluateGscDns(apex, value, resp);
}
