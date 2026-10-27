import { describe, expect, it } from "vitest";
import { encodeRoleChoice, parseRoleChoice } from "@/features/team/role-choice";

describe("role choice", () => {
  it("parses system and custom roles", () => {
    expect(parseRoleChoice("system:sales_associate")).toEqual({ role: "sales_associate", customRoleId: null });
    expect(parseRoleChoice("custom:3F2504E0-4F89-41D3-9A0C-0305E82C3301")).toEqual({ role: "custom", customRoleId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301" });
  });
  it("never allows assigning the owner role or unknown values", () => {
    for (const v of ["system:owner", "system:root", "custom:not-a-uuid", "admin", "", "system:"]) expect(parseRoleChoice(v)).toBeNull();
  });
  it("rejects the retired roles", () => {
    for (const r of ["admin", "staff", "viewer", "catalog_manager", "analyst", "support_agent"]) expect(parseRoleChoice(`system:${r}`)).toBeNull();
  });
  it("round-trips", () => {
    expect(parseRoleChoice(encodeRoleChoice("manager", null))).toEqual({ role: "manager", customRoleId: null });
  });
});
