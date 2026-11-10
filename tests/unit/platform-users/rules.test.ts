import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { accountActionDenial, isDeleteConfirmed, storesToDelete, temporaryPassword, type AccountActionFacts } from "@/features/platform-users/rules";

const base: AccountActionFacts = { actorId: "a", actorRole: "super_admin", targetId: "t", targetPlatformRole: null };

describe("Admin → Users permission rules", () => {
  it("never lets an admin target their own account", () => {
    for (const action of ["reset_link", "delete", "grant_super_admin", "revoke_super_admin"] as const) expect(accountActionDenial({ ...base, targetId: "a" }, action)).toMatch(/own account/);
  });

  it("keeps credential, role and delete actions for super admins", () => {
    for (const action of ["temp_password", "grant_super_admin", "revoke_super_admin", "delete"] as const) {
      expect(accountActionDenial({ ...base, actorRole: "support" }, action)).toMatch(/super admin/);
      expect(accountActionDenial({ ...base, actorRole: "finance" }, action)).toMatch(/super admin/);
    }
    expect(accountActionDenial({ ...base, actorRole: "support" }, "reset_link")).toBeNull();
  });

  it("grants super admin only to accounts without platform access, and revokes only from super admins", () => {
    expect(accountActionDenial(base, "grant_super_admin")).toBeNull();
    expect(accountActionDenial({ ...base, targetPlatformRole: "support" }, "grant_super_admin")).toMatch(/already has platform access/);
    expect(accountActionDenial({ ...base, targetPlatformRole: "super_admin" }, "revoke_super_admin")).toBeNull();
    expect(accountActionDenial(base, "revoke_super_admin")).toMatch(/isn't a super admin/);
    expect(accountActionDenial({ ...base, targetPlatformRole: "finance" }, "revoke_super_admin")).toMatch(/isn't a super admin/);
  });

  it("refuses to delete or reset platform staff", () => {
    for (const action of ["delete", "temp_password", "reset_link", "status", "add_customer"] as const) expect(accountActionDenial({ ...base, targetPlatformRole: "super_admin" }, action)).toMatch(/Platform staff/);
    expect(accountActionDenial(base, "delete")).toBeNull();
  });
});

describe("delete confirmation", () => {
  it("needs the exact word DELETE", () => {
    expect(isDeleteConfirmed("DELETE")).toBe(true);
    expect(isDeleteConfirmed("  DELETE ")).toBe(true);
    for (const v of ["delete", "Delete", "DELET", "DELETE!", "", null, undefined, 1]) expect(isDeleteConfirmed(v)).toBe(false);
  });

  it("deletes only stores the account owns alone", () => {
    expect(
      storesToDelete([
        { tenantId: "s1", role: "owner", otherOwners: 0 },
        { tenantId: "s2", role: "owner", otherOwners: 1 },
        { tenantId: "s3", role: "admin", otherOwners: 0 },
        { tenantId: "s1", role: "owner", otherOwners: 0 },
      ]),
    ).toEqual(["s1"]);
  });
});

describe("temporary password", () => {
  it("is 16 unambiguous characters with a letter and a digit", () => {
    for (let i = 0; i < 50; i++) {
      const p = temporaryPassword((n) => randomBytes(n));
      expect(p).toHaveLength(16);
      expect(p).toMatch(/[A-Za-z]/);
      expect(p).toMatch(/\d/);
      expect(p).not.toMatch(/[0O1lI]/);
    }
  });
});
