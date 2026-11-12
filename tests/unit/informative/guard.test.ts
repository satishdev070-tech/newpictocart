import { describe, expect, it } from "vitest";
import { informativePanelDecision } from "@/features/informative/guard";

describe("InformativeRouteGuard decision", () => {
  it("flag off: 404 for everyone except Informative accounts, who get maintenance", () => {
    expect(informativePanelDecision({ mode: "off", signedIn: false, activeType: null })).toBe("not-found");
    expect(informativePanelDecision({ mode: "off", signedIn: true, activeType: null })).toBe("not-found");
    expect(informativePanelDecision({ mode: "off", signedIn: true, activeType: "ONLINE_STORE" })).toBe("not-found");
    expect(informativePanelDecision({ mode: "off", signedIn: true, activeType: "INFORMATIVE" })).toBe("maintenance");
  });

  for (const mode of ["internal", "all"] as const) {
    it(`flag ${mode}: store accounts go to the store dashboard, informative accounts render`, () => {
      expect(informativePanelDecision({ mode, signedIn: false, activeType: null })).toBe("login");
      expect(informativePanelDecision({ mode, signedIn: true, activeType: null })).toBe("onboarding");
      expect(informativePanelDecision({ mode, signedIn: true, activeType: "ONLINE_STORE" })).toBe("store-dashboard");
      expect(informativePanelDecision({ mode, signedIn: true, activeType: "INFORMATIVE" })).toBe("render");
    });
  }
});
