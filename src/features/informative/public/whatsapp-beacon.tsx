"use client";

import { useEffect } from "react";

/**
 * Logs a tap on any "WhatsApp" link of a live Informative Website as a lead (source WHATSAPP_CLICK),
 * without delaying navigation (sendBeacon). Sends no personal data: only the service id when the tap
 * came from a service page. The server checks the host, Origin and a per-IP limit.
 */
export function WhatsAppBeacon() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const a = (e.target as Element | null)?.closest?.("a[data-enquiry-source='WHATSAPP_CLICK']");
      if (!a) return;
      const serviceId = a.getAttribute("data-service-id");
      const body = JSON.stringify(serviceId ? { serviceId } : {});
      try {
        if (!navigator.sendBeacon?.("/api/informative/whatsapp-click", new Blob([body], { type: "application/json" }))) {
          void fetch("/api/informative/whatsapp-click", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true });
        }
      } catch {
        // Never block the visitor.
      }
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  return null;
}
