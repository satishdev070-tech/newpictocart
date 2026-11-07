/**
 * Theme Editor preview entry helpers (mint + entry URL). Kept free of React so unit tests can
 * cover mint / deny-message paths. Canvas loads the iframe via real navigation — do not gate on
 * cross-origin `fetch(/preview)` (browsers hide 307 behind CORS / opaque redirect).
 */

import { refreshPreviewUrlAction } from "@/features/theme/actions";
import { previewEntryUrl } from "@/features/theme/preview";

export type MintedPreview = { token: string; expiresAt: number };

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
 * Mint (or reuse) a token and return the iframe entry URL.
 * Deny recovery is via 403 HTML `postMessage` after navigation — not a client fetch preflight
 * (cross-origin fetch never sees the 307 status in browsers).
 */
export async function resolvePreviewEntryUrl(opts: {
  storeOrigin: string;
  path: string;
  existing: MintedPreview | null;
  tokenMarginS: number;
  parentOrigin?: string | null;
  nowMs?: number;
  mint?: () => Promise<MintedPreview | null>;
}): Promise<{ ok: true; url: string; minted: MintedPreview } | { ok: false; error: string; soft?: boolean }> {
  const now = opts.nowMs ?? Date.now();
  const mint = opts.mint ?? mintPreviewEntry;

  let minted = opts.existing;
  if (!minted || minted.expiresAt - now / 1000 <= opts.tokenMarginS) {
    minted = await mint();
    if (!minted) return { ok: false, error: "The preview link could not be created.", soft: true };
  }

  return {
    ok: true,
    url: previewEntryUrl(opts.storeOrigin, minted.token, opts.path, opts.parentOrigin),
    minted,
  };
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
