import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import type { IncomingMessage } from "node:http";
import type { Readable } from "node:stream";

/**
 * SSRF-safe fetch for a reference website (theme builder). Rules:
 * - https only, default port only, no credentials in the URL, public hostnames (no IP literals
 *   in private ranges, no "localhost", no single-label names);
 * - every address the name resolves to must be public: the check runs inside the socket's DNS
 *   lookup, so the address that is connected to is the one that was checked (no DNS rebinding
 *   between check and connect);
 * - redirects are followed manually (max 3) and each hop is checked again;
 * - total time and body size are capped, and only text responses are read.
 */

export const FETCH_LIMITS = { timeoutMs: 8_000, maxBytes: 1_500_000, maxRedirects: 3 } as const;

export class FetchGuardError extends Error {
  constructor(
    readonly reason: "invalid_url" | "blocked_host" | "blocked_address" | "too_large" | "timeout" | "http_error" | "not_text" | "too_many_redirects" | "network",
    message: string,
  ) {
    super(message);
    this.name = "FetchGuardError";
  }
}

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

/** True for loopback, private, link-local, CGNAT, multicast, documentation and other non-public addresses. */
export function isBlockedAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, "").split("%")[0]!;
  const family = isIP(ip);
  if (family === 4) return blocked.check(ip, "ipv4");
  if (family === 6) {
    // IPv4-mapped / compatible (::ffff:10.0.0.1, ::ffff:a00:1): judge the embedded IPv4 address.
    const mapped = ip.match(/^::(?:ffff:(?:0:)?)?(\d+\.\d+\.\d+\.\d+)$/i);
    if (mapped) return blocked.check(mapped[1]!, "ipv4");
    const hex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (hex) {
      const n = (parseInt(hex[1]!, 16) << 16) | parseInt(hex[2]!, 16);
      return blocked.check([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join("."), "ipv4");
    }
    return blocked.check(ip, "ipv6");
  }
  return true;
}

/** Parses and checks a reference URL (no network). Throws FetchGuardError("invalid_url" | "blocked_host"). */
export function assertSafeUrl(raw: string | URL): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchGuardError("invalid_url", "Enter a full website address starting with https://");
  }
  if (url.protocol !== "https:") throw new FetchGuardError("invalid_url", "Only https:// websites can be used as a reference.");
  if (url.username || url.password) throw new FetchGuardError("invalid_url", "The address can't contain a username or password.");
  if (url.port && url.port !== "443") throw new FetchGuardError("blocked_host", "Only websites on the standard https port can be used.");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (isIP(host.replace(/^\[|\]$/g, ""))) {
    if (isBlockedAddress(host)) throw new FetchGuardError("blocked_host", "Private or local addresses can't be fetched.");
    return url;
  }
  if (!host.includes(".") || host === "localhost" || /\.(localhost|local|internal|intranet|lan|home|corp|test|invalid|example|onion)$/.test(host)) {
    throw new FetchGuardError("blocked_host", "Private or local addresses can't be fetched.");
  }
  return url;
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;
export type Resolver = (hostname: string, cb: (err: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void) => void;

const systemResolver: Resolver = (hostname, cb) => dnsLookup(hostname, { all: true, verbatim: true }, (err, addresses) => cb(err, addresses ?? []));

/** A socket `lookup` that refuses to connect when ANY resolved address is non-public. */
export function guardedLookup(resolve: Resolver = systemResolver): LookupFunction {
  return ((hostname: string, options: { all?: boolean }, callback: LookupCallback) => {
    resolve(hostname, (err, addresses) => {
      if (err) return callback(err, "", 0);
      if (!addresses.length) return callback(Object.assign(new Error("no addresses"), { code: "ENOTFOUND" }), "", 0);
      const bad = addresses.find((a) => isBlockedAddress(a.address));
      if (bad) return callback(Object.assign(new FetchGuardError("blocked_address", "That website resolves to a private address."), { code: "EBLOCKED" }), "", 0);
      if (options?.all) return callback(null, addresses);
      callback(null, addresses[0]!.address, addresses[0]!.family);
    });
  }) as unknown as LookupFunction;
}

/** Reads a stream up to `maxBytes`; throws "too_large" past it (and destroys the stream). */
export async function readLimited(stream: Readable, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer);
    size += buf.length;
    if (size > maxBytes) {
      stream.destroy();
      throw new FetchGuardError("too_large", "The page is too large to analyse.");
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

export type SafeFetchOptions = { timeoutMs?: number; maxBytes?: number; maxRedirects?: number; accept?: "html" | "css"; resolver?: Resolver };
export type SafeFetchResult = { url: string; contentType: string; body: string };

function once(url: URL, lookup: LookupFunction, accept: string, signal: AbortSignal): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(url, { method: "GET", lookup, signal, headers: { accept, "accept-encoding": "identity", "user-agent": "PictocartThemeBuilder/1.0 (+https://pictocart.in)" } }, resolve);
    req.on("error", reject);
    req.end();
  });
}

/** GET a public https URL as text, following checked redirects. Throws FetchGuardError only. */
export async function safeFetchText(raw: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const { timeoutMs = FETCH_LIMITS.timeoutMs, maxBytes = FETCH_LIMITS.maxBytes, maxRedirects = FETCH_LIMITS.maxRedirects, accept = "html" } = opts;
  const lookup = guardedLookup(opts.resolver);
  const signal = AbortSignal.timeout(timeoutMs);
  let url = assertSafeUrl(raw);
  for (let hop = 0; ; hop++) {
    let res: IncomingMessage;
    try {
      res = await once(url, lookup, accept === "css" ? "text/css,*/*;q=0.1" : "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1", signal);
    } catch (err) {
      if (err instanceof FetchGuardError) throw err;
      const e = err as NodeJS.ErrnoException & { cause?: unknown };
      if (e.cause instanceof FetchGuardError) throw e.cause;
      if (e.name === "AbortError" || e.name === "TimeoutError" || signal.aborted) throw new FetchGuardError("timeout", "The website took too long to respond.");
      throw new FetchGuardError("network", "The website couldn't be reached.");
    }
    const status = res.statusCode ?? 0;
    if (status >= 300 && status < 400 && res.headers.location) {
      res.resume();
      if (hop >= maxRedirects) throw new FetchGuardError("too_many_redirects", "The website redirected too many times.");
      url = assertSafeUrl(new URL(res.headers.location, url));
      continue;
    }
    if (status < 200 || status >= 300) {
      res.resume();
      throw new FetchGuardError("http_error", `The website answered with HTTP ${status}.`);
    }
    const contentType = String(res.headers["content-type"] ?? "").toLowerCase();
    const okType = accept === "css" ? /text\/css|text\/plain/.test(contentType) || !contentType : /text\/html|application\/xhtml/.test(contentType);
    if (!okType) {
      res.resume();
      throw new FetchGuardError("not_text", accept === "css" ? "Not a stylesheet." : "That address isn't a web page.");
    }
    const declared = Number(res.headers["content-length"] ?? 0);
    if (declared > maxBytes) {
      res.destroy();
      throw new FetchGuardError("too_large", "The page is too large to analyse.");
    }
    try {
      const buf = await readLimited(res, maxBytes);
      return { url: url.toString(), contentType, body: buf.toString("utf8") };
    } catch (err) {
      if (err instanceof FetchGuardError) throw err;
      if (signal.aborted) throw new FetchGuardError("timeout", "The website took too long to respond.");
      throw new FetchGuardError("network", "The website couldn't be read.");
    }
  }
}
