import { describe, expect, it } from "vitest";
import { adminTransferOwnerSchema } from "@/features/platform/schemas";

const tenantId = "10000000-0000-4000-a000-00000000000a";
const reason = "Seller asked to move the store to their partner";

describe("adminTransferOwnerSchema", () => {
  it("normalises the email and reads the checkbox", () => {
    const v = adminTransferOwnerSchema.parse({ tenantId, newOwnerEmail: "  NKushwaha@Example.com ", removePrevious: "on", reason });
    expect(v).toEqual({ tenantId, newOwnerEmail: "nkushwaha@example.com", removePrevious: true, reason });
  });

  it("an unticked checkbox keeps the previous owner", () => {
    expect(adminTransferOwnerSchema.parse({ tenantId, newOwnerEmail: "a@b.in", reason }).removePrevious).toBe(false);
  });

  it("requires a valid email, a store id and a reason", () => {
    expect(adminTransferOwnerSchema.safeParse({ tenantId, newOwnerEmail: "not-an-email", reason }).success).toBe(false);
    expect(adminTransferOwnerSchema.safeParse({ tenantId: "x", newOwnerEmail: "a@b.in", reason }).success).toBe(false);
    expect(adminTransferOwnerSchema.safeParse({ tenantId, newOwnerEmail: "a@b.in", reason: "short" }).success).toBe(false);
  });
});
