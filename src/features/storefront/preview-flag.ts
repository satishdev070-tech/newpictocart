import { cache } from "react";

/**
 * Per-request flag for draft/builder preview (`sf.preview`). Set once in the storefront layout;
 * StoreImage / StoreArtImage read it so `priority` never becomes LCP-eager while the site builder
 * iframe remounts pages (published storefront LCP stays unchanged).
 */
const state = cache(() => ({ preview: false }));

export function markStorefrontPreview(preview: boolean): void {
  state().preview = preview;
}

export function isStorefrontPreview(): boolean {
  return state().preview;
}
