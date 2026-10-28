/**
 * Who may do what on Admin → Users (pure, unit tested; the server re-reads every fact it passes in).
 * Platform staff accounts are only touched by the Super Admin grant/revoke pair; your own account
 * is never a target; destructive or credential actions are super admin only.
 */
import type { PlatformRole } from "@/lib/permissions/matrix";

export const ACCOUNT_ACTIONS = ["reset_link", "temp_password", "status", "grant_super_admin", "revoke_super_admin", "add_customer", "delete"] as const;
export type AccountAction = (typeof ACCOUNT_ACTIONS)[number];

const SUPER_ADMIN_ONLY: ReadonlySet<AccountAction> = new Set(["temp_password", "grant_super_admin", "revoke_super_admin", "delete"]);

export type AccountActionFacts = {
  actorId: string;
  actorRole: PlatformRole;
  targetId: string;
  /** Target's platform_memberships role (any status), or null. */
  targetPlatformRole: string | null;
};

/** Null when allowed, otherwise the message to show. */
export function accountActionDenial(f: AccountActionFacts, action: AccountAction): string | null {
  if (f.actorId === f.targetId) return "You can't change your own account here.";
  if (SUPER_ADMIN_ONLY.has(action) && f.actorRole !== "super_admin") return "Only a super admin can do this.";
  if (action === "revoke_super_admin") return f.targetPlatformRole === "super_admin" ? null : "This account isn't a super admin.";
  if (f.targetPlatformRole) return action === "grant_super_admin" ? "This account already has platform access. Change it on Platform users." : "Platform staff are managed on Platform users. Remove their platform access first.";
  return null;
}

/** The phrase the admin must type to delete an account. Exact and case-sensitive. */
export const DELETE_CONFIRM_PHRASE = "DELETE";

export function isDeleteConfirmed(typed: unknown): boolean {
  return typeof typed === "string" && typed.trim() === DELETE_CONFIRM_PHRASE;
}

export type OwnedStore = { tenantId: string; role: string; otherOwners: number };

/**
 * Stores deleted together with the account: those it owns alone. A store with another owner is
 * kept (only this person's membership goes), so deleting one co-owner never wipes a shared store.
 */
export function storesToDelete(memberships: readonly OwnedStore[]): string[] {
  return [...new Set(memberships.filter((m) => m.role === "owner" && m.otherOwners === 0).map((m) => m.tenantId))];
}

/** 16 characters from an unambiguous alphabet, with at least one letter and one digit (meets signup rules). */
export function temporaryPassword(randomBytes: (n: number) => Uint8Array): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  for (;;) {
    const bytes = randomBytes(32);
    let out = "";
    for (const b of bytes) {
      // Rejection sampling keeps the distribution uniform (bytes ≥ 4 × alphabet length are skipped).
      if (b >= alphabet.length * Math.floor(256 / alphabet.length)) continue;
      out += alphabet[b % alphabet.length];
      if (out.length === 16) break;
    }
    if (out.length === 16 && /[A-Za-z]/.test(out) && /\d/.test(out)) return out;
  }
}
