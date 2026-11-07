/**
 * Theme Editor preview entry helpers (mint + preflight). Kept free of React so unit tests can
 * cover the Network 403 / disconnect paths that leave the canvas stuck at “Loading 92%”.
 */

import { refreshPreviewUrlAction } from "@/features/theme/actions";
import { previewEntryUrl } from "@/features/theme/preview";

export type MintedPreview = { token: string; expiresAt: number };

export type PreviewPreflight =
  | { ok: true }
  | { ok: false; kind: "denied"; reason: string }
  | { ok: false; kind: "network" };

/** Token from a preview entry URL (`/preview?token=…`). */
export function tokenOf(url: string): string | null {
  try {
    return new URL(url).searchParams.get("token");
  } catch {
    return null;
  }
}

const MINT_ATTEMPTS = 3;

async function mintViaApi(): Promise<MintedPreview | null> {
  const res = await fetch("/api/theme/preview-token", { method: "POST", credentials: "same-origin", cache: "no-store" });
  if (!res.ok) return null;
  const body = (await res.json()) as { ok?: boolean; url?: string; expiresAt?: number };
  const tok = body.ok && body.url ? tokenOf(body.url) : null;
  if (!tok || typeof body.expiresAt !== "number") return null;
  return { token: tok, expiresAt: body.expiresAt };
}

/**
 * Mint via Workers route handler (with retries on network failure), then fall back to the RSC
 * server action. Disconnects are soft — callers should not burn recovery budget on them.
 */
export async function mintPreviewEntry(): Promise<MintedPreview | null> {
  for (let i = 0; i < MINT_ATTEMPTS; i++) {
    try {
      const minted = await mintViaApi();
      if (minted) return minted;
    } catch {
      // Network blip — retry before falling back.
    }
  }
  try {
    const r = await refreshPreviewUrlAction();
    const tok = r.ok ? tokenOf(r.data.url) : null;
    if (!r.ok || !tok) return null;
    return { token: tok, expiresAt: r.data.expiresAt };
  } catch {
    return null;
  }
}

/** Pull `data-preview-error="…"` from the /preview 403 HTML body. */
export function previewDenyReasonFromHtml(html: string): string | null {
  const m = /data-preview-error="([^"]+)"/.exec(html);
  return m?.[1] ?? null;
}

/**
 * Probe `/preview?token=…` before setting iframe.src.
 * - 302/307 → safe to navigate the iframe (cookie is set on the real navigation).
 * - 403 with data-preview-error → typed deny (do not hang at 92%).
 * - network / opaque → soft failure for retry.
 */
export async function preflightPreviewEntry(url: string, fetchImpl: typeof fetch = fetch): Promise<PreviewPreflight> {
  try {
    const res = await fetchImpl(url, { redirect: "manual", credentials: "omit", cache: "no-store" });
    if (res.status === 301 || res.status === 302 || res.status === 303 || res.status === 307 || res.status === 308) {
      return { ok: true };
    }
    if (res.status === 403) {
      const reason = previewDenyReasonFromHtml(await res.text()) ?? "bad_token";
      return { ok: false, kind: "denied", reason };
    }
    // Unexpected status (CF challenge HTML, 5xx, …) — treat as soft so we can remint/retry.
    return { ok: false, kind: "network" };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/**
 * Mint (or reuse) a token, preflight `/preview`, remint once on typed deny.
 * Returns the entry URL to load in the iframe, or a typed failure.
 */
export async function resolvePreviewEntryUrl(opts: {
  storeOrigin: string;
  path: string;
  existing: MintedPreview | null;
  tokenMarginS: number;
  nowMs?: number;
  mint?: () => Promise<MintedPreview | null>;
  preflight?: (url: string) => Promise<PreviewPreflight>;
}): Promise<{ ok: true; url: string; minted: MintedPreview } | { ok: false; error: string; soft?: boolean }> {
  const now = opts.nowMs ?? Date.now();
  const mint = opts.mint ?? mintPreviewEntry;
  const preflight = opts.preflight ?? ((url: string) => preflightPreviewEntry(url));

  let minted = opts.existing;
  if (!minted || minted.expiresAt - now / 1000 <= opts.tokenMarginS) {
    minted = await mint();
    if (!minted) return { ok: false, error: "The preview link could not be created.", soft: true };
  }

  const tryOnce = async (m: MintedPreview) => {
    const url = previewEntryUrl(opts.storeOrigin, m.token, opts.path);
    const result = await preflight(url);
    return { url, minted: m, result };
  };

  let attempt = await tryOnce(minted);
  if (attempt.result.ok) return { ok: true, url: attempt.url, minted: attempt.minted };

  if (attempt.result.kind === "denied") {
    // Fresh token — if it still denies, surface the reason immediately.
    const reminted = await mint();
    if (!reminted) return { ok: false, error: `Preview blocked (${attempt.result.reason}). Retry to continue.` };
    attempt = await tryOnce(reminted);
    if (attempt.result.ok) return { ok: true, url: attempt.url, minted: attempt.minted };
    if (attempt.result.kind === "denied") {
      return { ok: false, error: `Preview blocked (${attempt.result.reason}). Retry to continue.` };
    }
    return { ok: false, error: "The store preview didn't connect. Retry to continue.", soft: true };
  }

  // Soft network failure on first preflight — remint once more then give soft error.
  const reminted = await mint();
  if (reminted) {
    attempt = await tryOnce(reminted);
    if (attempt.result.ok) return { ok: true, url: attempt.url, minted: attempt.minted };
    if (attempt.result.kind === "denied") {
      return { ok: false, error: `Preview blocked (${attempt.result.reason}). Retry to continue.` };
    }
  }
  return { ok: false, error: "The store preview didn't connect. Retry to continue.", soft: true };
}

/** Whether a postMessage payload is a /preview deny signal from the store origin. */
export function isPreviewDeniedMessage(data: unknown): data is { source: "pictocart-preview"; type: "denied"; reason?: string } {
  return (
    !!data &&
    typeof data === "object" &&
    (data as { source?: unknown }).source === "pictocart-preview" &&
    (data as { type?: unknown }).type === "denied"
  );
}
