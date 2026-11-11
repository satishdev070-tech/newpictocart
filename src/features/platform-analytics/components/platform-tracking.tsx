"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { PlatformAnalytics } from "@/features/marketing-site/components/platform-analytics";
import { PAGEVIEW_ENDPOINT, PAGEVIEW_SESSION_KEY } from "../pageview";

const PIXEL_RE = /^\d{10,20}$/;

function optedOut(): boolean {
  return typeof navigator !== "undefined" && ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true || navigator.doNotTrack === "1");
}

/** Random per-tab id (sessionStorage); a fresh one if storage is blocked. */
function sessionId(): string {
  try {
    const existing = sessionStorage.getItem(PAGEVIEW_SESSION_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(PAGEVIEW_SESSION_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** Sends one first-party page view per route. Path only (no query string). */
function FirstPartyBeacon() {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);
  useEffect(() => {
    if (optedOut()) return;
    const ref = previous.current ?? document.referrer;
    previous.current = `${location.origin}${pathname}`;
    try {
      const body = JSON.stringify({ sid: sessionId(), path: pathname, ref });
      if (!navigator.sendBeacon?.(PAGEVIEW_ENDPOINT, new Blob([body], { type: "text/plain" }))) {
        void fetch(PAGEVIEW_ENDPOINT, { method: "POST", body, keepalive: true, credentials: "omit" }).catch(() => undefined);
      }
    } catch {
      // analytics must never break the page
    }
  }, [pathname]);
  return null;
}

/** Meta Pixel base code for platform pages, built from the numeric id only. */
function MetaPixel({ id }: { id: string }) {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.fbq?.("track", "PageView");
  }, [pathname]);
  if (!PIXEL_RE.test(id) || optedOut()) return null;
  return (
    <Script id="platform-meta-pixel" strategy="lazyOnload">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(id)});fbq('track','PageView');`}
    </Script>
  );
}

/**
 * Platform-page analytics (marketing site, seller sign-in, /start): Google tag, Meta Pixel and
 * the first-party visitor beacon, each switched in Super Admin → Analytics. Never rendered on
 * merchant storefronts (their own TrackingTags) or admin pages. Honours GPC / Do Not Track.
 */
export function PlatformTracking({ ga4Id, metaPixelId, firstParty }: { ga4Id: string | null; metaPixelId: string | null; firstParty: boolean }) {
  return (
    <>
      {ga4Id ? <PlatformAnalytics id={ga4Id} /> : null}
      {metaPixelId ? <MetaPixel id={metaPixelId} /> : null}
      {firstParty ? <FirstPartyBeacon /> : null}
    </>
  );
}
