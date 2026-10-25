"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminListUnsplashAction, adminUseUnsplashAction } from "../unsplash-actions";
import type { UnsplashPhoto } from "../unsplash/photos";
import { UnsplashBrowser, actionError } from "./unsplash-browser";

/**
 * Super-admin Unsplash library: the photos the marketing site's theme and category cards use, and
 * search. "Copy URL" records the use with Unsplash (download endpoint) and copies a hotlink URL
 * for image fields in the landing CMS; the credit is copied alongside so it can be shown.
 */
export function AdminUnsplashLibrary() {
  const [state, setState] = useState<Record<string, { status: "pending" | "done" | "error"; text?: string }>>({});
  const use = async (p: UnsplashPhoto) => {
    setState((s) => ({ ...s, [p.id]: { status: "pending" } }));
    const r = await adminUseUnsplashAction({ id: p.id });
    if (!r.ok) return setState((s) => ({ ...s, [p.id]: { status: "error", text: actionError(r) } }));
    try {
      await navigator.clipboard.writeText(r.data.url);
      setState((s) => ({ ...s, [p.id]: { status: "done", text: `Copied. Credit: ${r.data.credit}` } }));
    } catch {
      setState((s) => ({ ...s, [p.id]: { status: "done", text: r.data.url } }));
    }
  };
  return (
    <UnsplashBrowser
      load={adminListUnsplashAction}
      noKeyNote="No Unsplash API key is set (add one in the card above), so only the built-in fallback photos are listed and search covers those only."
      action={(p) => {
        const st = state[p.id];
        return (
          <>
            <Button size="sm" variant="secondary" pending={st?.status === "pending"} onClick={() => void use(p)}>
              {st?.status === "done" ? <Check aria-hidden /> : <Copy aria-hidden />} Copy URL
            </Button>
            {st?.text ? <p className={`mt-1 break-all text-caption ${st.status === "error" ? "text-error" : "text-muted"}`}>{st.text}</p> : null}
          </>
        );
      }}
    />
  );
}
