"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const ID_RE = /^G-[A-Z0-9]{4,20}$/;

/**
 * GA4 cross-domain measurement (set in the GA admin "Configure your domains") appends `?_gl=…`
 * to links into *.pictocart.in on mousedown, so store and website links opened from the admin or
 * seller panels carried a long useless suffix. gtag stays loaded after client-side navigation
 * into those panels, so this runs once per page life inside the same inline script: on click /
 * middle-click / context menu (after gtag's mousedown decoration, before the browser follows the
 * link) it removes `_gl` from the link. Exported for the unit test.
 */
export const STRIP_LINKER_PARAM = `(function(){if(window.__pcStripGl)return;window.__pcStripGl=1;var f=function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a||a.href.indexOf('_gl=')<0)return;try{var u=new URL(a.href);u.searchParams.delete('_gl');a.href=u.toString();}catch(_){}};['click','auxclick','contextmenu'].forEach(function(t){document.addEventListener(t,f,true);});})();`;

/**
 * Google tag (GA4) for the platform's own marketing pages, configured in /admin/analytics.
 * Not loaded for visitors with Global Privacy Control or Do Not Track. Sends page_view on
 * client-side navigations and the `data-analytics` CTA clicks as GA4 events.
 */
export function PlatformAnalytics({ id }: { id: string }) {
  const pathname = usePathname();
  const first = useRef(true);
  const optedOut = typeof navigator !== "undefined" && ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true || navigator.doNotTrack === "1");
  const valid = ID_RE.test(id) && !optedOut;

  useEffect(() => {
    if (!valid) return;
    if (first.current) {
      first.current = false;
      return;
    }
    window.gtag?.("event", "page_view", { page_path: pathname, page_location: window.location.href });
  }, [pathname, valid]);

  useEffect(() => {
    if (!valid) return;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.("[data-analytics]");
      if (!el) return;
      window.gtag?.("event", el.getAttribute("data-analytics") ?? "cta_click", { cta_id: el.getAttribute("data-analytics-id"), cta_location: el.getAttribute("data-analytics-location") });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [valid]);

  if (!valid) return null;
  // lazyOnload keeps gtag off the critical path (marketing LCP / TBT); page_view still fires after load.
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="lazyOnload" />
      <Script id="platform-gtag" strategy="lazyOnload">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config',${JSON.stringify(id)});${STRIP_LINKER_PARAM}`}</Script>
    </>
  );
}
