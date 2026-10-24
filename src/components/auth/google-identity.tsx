"use client";

import { useEffect, useRef, useState } from "react";
import { googleIdTokenSignInAction } from "@/features/auth/actions";

/**
 * Google's own sign-in button (Google Identity Services). The sign-in happens on this site's
 * origin, so Google shows pictocartdev.in, not the Supabase project URL, and the ID token is
 * exchanged for a Supabase session server-side. Needs this origin under "Authorised JavaScript
 * origins" of the Google OAuth client. `fallback` (the redirect flow) shows if Google can't load.
 */

type GoogleId = {
  accounts: {
    id: {
      initialize: (cfg: Record<string, unknown>) => void;
      renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
    };
  };
};

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

function loadScript(): Promise<GoogleId> {
  const w = window as unknown as { google?: GoogleId };
  if (w.google?.accounts?.id) return Promise.resolve(w.google);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const s = existing ?? document.createElement("script");
    s.addEventListener("load", () => (w.google ? resolve(w.google) : reject(new Error("gsi"))));
    s.addEventListener("error", () => reject(new Error("gsi")));
    if (!existing) {
      s.src = SCRIPT_SRC;
      s.async = true;
      document.head.append(s);
    }
    setTimeout(() => reject(new Error("timeout")), 8000);
  });
}

/** Random URL-safe nonce and its SHA-256 hex (Google gets the hash, Supabase the raw value). */
async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const raw = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return { raw, hashed };
}

export function GoogleIdentityButton({ clientId, next, text = "continue_with", fallback }: { clientId: string; next?: string; text?: "continue_with" | "signup_with" | "signin_with"; fallback: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const [google, nonce] = await Promise.all([loadScript(), makeNonce()]);
        if (!live || !box.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          nonce: nonce.hashed,
          ux_mode: "popup",
          use_fedcm_for_button: true,
          callback: async (resp: { credential?: string }) => {
            if (!resp.credential) return;
            setBusy(true);
            setError(null);
            const r = await googleIdTokenSignInAction({ credential: resp.credential, nonce: nonce.raw, next });
            if (r.ok) window.location.assign(r.data.next);
            else {
              setBusy(false);
              setError(r.error.message);
            }
          },
        });
        google.accounts.id.renderButton(box.current, { type: "standard", theme: "outline", size: "large", text, shape: "rectangular", logo_alignment: "center", width: Math.min(box.current.clientWidth || 400, 400) });
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [clientId, next, text]);

  if (failed) return <>{fallback}</>;
  return (
    <div className="space-y-2">
      <div ref={box} className={busy ? "pointer-events-none flex min-h-[44px] justify-center opacity-60" : "flex min-h-[44px] justify-center"} aria-busy={busy} />
      {error ? (
        <p role="alert" className="text-center text-small text-error">
          {error}
        </p>
      ) : null}
      <p className="text-center">
        <button type="button" onClick={() => setFailed(true)} className="text-xs text-muted underline-offset-2 hover:underline">
          Trouble with Google? Try another way
        </button>
      </p>
    </div>
  );
}
