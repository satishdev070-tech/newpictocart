import { describe, expect, it } from "vitest";
import { DEFAULT_LANDING, fillTokens, isSafeHref, parseHighlights, parseLanding, SECTION_KEYS, stripHighlights, validateLanding, whatsappHref } from "@/features/marketing-site/landing";

describe("landing CMS document", () => {
  it("defaults are valid against the save schema", () => {
    expect(validateLanding(DEFAULT_LANDING).ok).toBe(true);
  });

  it("falls back per section: one broken section never breaks the page", () => {
    const stored = { ...DEFAULT_LANDING, hero: { ...DEFAULT_LANDING.hero, titleLead: "Sell online" }, faq: { enabled: "yes" } };
    const parsed = parseLanding(stored);
    expect(parsed.hero.titleLead).toBe("Sell online");
    expect(parsed.faq).toEqual(DEFAULT_LANDING.faq);
  });

  it("returns the defaults for empty or garbage values", () => {
    expect(parseLanding(null)).toEqual(DEFAULT_LANDING);
    expect(parseLanding("nope")).toEqual(DEFAULT_LANDING);
    expect(parseLanding([1, 2])).toEqual(DEFAULT_LANDING);
  });

  it("keeps a stored order and appends sections it doesn't list", () => {
    const parsed = parseLanding({ order: ["cta", "hero"] });
    expect(parsed.order.slice(0, 2)).toEqual(["cta", "hero"]);
    expect([...parsed.order].sort()).toEqual([...SECTION_KEYS].sort());
  });

  it("rejects duplicate sections and unsafe links on save", () => {
    expect(validateLanding({ ...DEFAULT_LANDING, order: ["hero", "hero"] }).ok).toBe(false);
    const bad = { ...DEFAULT_LANDING, header: { ...DEFAULT_LANDING.header, ctaHref: "javascript:alert(1)" } };
    const result = validateLanding(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.path).toBe("header.ctaHref");
  });

  it("only allows paths, anchors, https, mailto and tel links", () => {
    for (const ok of ["", "/pricing", "#faq", "https://pictocart.in", "mailto:hi@pictocart.in", "tel:+919876543210"]) expect(isSafeHref(ok)).toBe(true);
    for (const bad of ["javascript:alert(1)", "//evil.com", "http://insecure.example", "data:text/html,x", "ftp://x"]) expect(isSafeHref(bad)).toBe(false);
  });
});

describe("heading highlights", () => {
  it("splits coloured parts", () => {
    expect(parseHighlights("Now {purple:what to sell} and {green:where}")).toEqual([
      { text: "Now ", color: null },
      { text: "what to sell", color: "purple" },
      { text: " and ", color: null },
      { text: "where", color: "green" },
    ]);
  });

  it("leaves unknown colours and plain braces alone", () => {
    expect(parseHighlights("{red:x} {themes}")).toEqual([{ text: "{red:x} {themes}", color: null }]);
    expect(stripHighlights("In {orange:5 Steps}")).toBe("In 5 Steps");
  });

  it("fills live tokens", () => {
    expect(fillTokens("{themes}", { themes: 184 })).toBe("184");
    expect(fillTokens("{unknown} left", {})).toBe("{unknown} left");
  });
});

describe("WhatsApp button", () => {
  it("builds a wa.me link only for a valid number", () => {
    expect(whatsappHref("", "hi")).toBeNull();
    expect(whatsappHref("12345", "hi")).toBeNull();
    expect(whatsappHref("919876543210", "Hi there")).toBe("https://wa.me/919876543210?text=Hi%20there");
  });
});
