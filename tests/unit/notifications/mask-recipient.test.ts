import { describe, expect, it } from "vitest";
import { maskRecipient } from "@/features/notifications/whatsapp/mask-recipient";

describe("maskRecipient", () => {
  it("masks long phone numbers without throwing", () => {
    expect(maskRecipient("919876543210")).toBe("••••••••3210");
    expect(maskRecipient("+91 98765 43210")).toMatch(/3210$/);
  });

  it("guards null / empty / short values (no .slice crash)", () => {
    expect(maskRecipient(null)).toBe("—");
    expect(maskRecipient(undefined)).toBe("—");
    expect(maskRecipient("")).toBe("—");
    expect(maskRecipient("   ")).toBe("—");
    expect(maskRecipient("12")).toBe("••••");
    expect(maskRecipient("1234")).toBe("••••");
  });
});
