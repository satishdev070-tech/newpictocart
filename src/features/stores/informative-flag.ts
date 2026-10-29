/** Client + server: Informational Website creation/switch-to is gated (legacy informative stores still work). */
export function informativeSitesEnabled(): boolean {
  return process.env.NEXT_PUBLIC_INFORMATIVE_SITES_ENABLED === "true";
}
