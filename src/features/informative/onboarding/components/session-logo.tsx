"use client";

import { useEffect } from "react";
import { INFO_PREVIEW_LOGO_KEY, LOGO_DATA_URL_RE } from "../draft";

/**
 * Onboarding preview only: shows the logo the person picked before they have an account (it lives in
 * sessionStorage, same origin) in the header of the theme preview iframe. Nothing is uploaded.
 */
export function SessionLogo({ alt }: { alt: string }) {
  useEffect(() => {
    let src: string | null = null;
    try {
      src = window.sessionStorage.getItem(INFO_PREVIEW_LOGO_KEY);
    } catch {
      return;
    }
    if (!src || !LOGO_DATA_URL_RE.test(src)) return;
    for (const brand of document.querySelectorAll<HTMLElement>("[data-if-brand]")) {
      if (brand.querySelector("img")) continue;
      const img = document.createElement("img");
      img.src = src;
      img.alt = alt;
      img.width = 160;
      img.height = 40;
      img.className = "h-10 w-auto max-w-40 object-contain";
      brand.insertBefore(img, brand.firstChild);
    }
  }, [alt]);
  return null;
}
