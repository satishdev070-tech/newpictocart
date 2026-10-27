/**
 * Blocked shoppers (Customers → Status "Blocked"). Shown only to a session that already proved who
 * it is (correct password, valid code or link), so it never reveals whether other emails exist.
 */
export const BLOCKED_ACCOUNT_MESSAGE = "Your account is blocked. Please contact the store if you think this is a mistake.";

export type CustomerAccess = "none" | "active" | "blocked";

/** Access for a customer row: no row yet (link/create may follow), active, or blocked (any non-active status). */
export function customerAccess(row: { status: string } | null | undefined): CustomerAccess {
  if (!row) return "none";
  return row.status === "active" ? "active" : "blocked";
}
