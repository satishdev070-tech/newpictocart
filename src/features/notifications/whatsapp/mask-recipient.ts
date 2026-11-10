/** Mask a phone/recipient for display (••••1234). Empty/null-safe so a bad row cannot crash the page. */
export function maskRecipient(recipient: string | null | undefined): string {
  const s = typeof recipient === "string" ? recipient.trim() : "";
  if (!s) return "—";
  if (s.length <= 4) return "••••";
  return `${s.slice(0, -4).replace(/\d/g, "•")}${s.slice(-4)}`;
}
