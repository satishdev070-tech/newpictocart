import { describe, expect, it } from "vitest";
import { buildRegisterHref } from "@/features/start/build-register-href";

describe("buildRegisterHref", () => {
  it("carries locale and intent into register", () => {
    expect(buildRegisterHref({ locale: "hi-IN", intent: "first-business" })).toBe(
      "/seller/register?lang=hi-IN&intent=first-business",
    );
  });

  it("includes optional plan and theme", () => {
    const href = buildRegisterHref({
      locale: "en-IN",
      intent: "social-seller",
      plan: "starter",
      theme: "kota-craft",
    });
    expect(href).toContain("lang=en-IN");
    expect(href).toContain("intent=social-seller");
    expect(href).toContain("plan=starter");
    expect(href).toContain("theme=kota-craft");
  });
});
