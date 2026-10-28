/**
 * AI credits wallet summary for the dashboard card (pure, unit tested). Uses only the store's
 * own ledger and the platform's per-action "minutes saved" table; refunded uses don't count.
 */
export type WalletLedgerRow = { id: string; delta: number; kind: string; note: string | null; referenceId: string | null; createdAt: string };
export type WalletSummary = { available: boolean; balance: number; usedCredits: number; uses: number; minutesSaved: number };

export function summarizeWallet(balance: number | null, rows: WalletLedgerRow[], minutesByKind: Record<string, number>): WalletSummary {
  if (balance === null) return { available: false, balance: 0, usedCredits: 0, uses: 0, minutesSaved: 0 };
  const refunded = new Set(rows.filter((r) => r.kind === "usage_refund" && r.referenceId).map((r) => r.referenceId!));
  let usedCredits = 0;
  let uses = 0;
  let minutesSaved = 0;
  for (const r of rows) {
    if (r.kind !== "usage" || refunded.has(r.id)) continue;
    uses += 1;
    usedCredits += Math.max(0, -r.delta);
    minutesSaved += minutesByKind[r.note ?? ""] ?? 0;
  }
  return { available: true, balance, usedCredits, uses, minutesSaved };
}

/** "6.0" hours, one decimal. */
export const hoursLabel = (minutes: number) => (Math.round((minutes / 60) * 10) / 10).toFixed(1);
