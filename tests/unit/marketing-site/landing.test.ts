import { describe, expect, it } from "vitest";
import { chipFromLabel, DEFAULT_LANDING, fillTokens, isSafeHref, parseHighlights, parseLanding, SECTION_KEYS, stripHighlights, validateLanding, whatsappHref } from "@/features/marketing-site/landing";

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

describe("redesigned sections (hero slides, chips, categories, card colours)", () => {
  const legacyHero = (() => {
    const { slides: _s, slideInterval: _i, autoplay: _a, ...rest } = DEFAULT_LANDING.hero;
    return { ...rest, imageUrl: "https://cdn.example.com/hero.png" };
  })();

  it("reads a hero saved before slides existed, with slideshow defaults", () => {
    const hero = parseLanding({ hero: legacyHero }).hero;
    expect(hero.imageUrl).toBe("https://cdn.example.com/hero.png");
    expect(hero.slides).toEqual([]);
    expect(hero.slideInterval).toBe(5);
    expect(hero.autoplay).toBe(true);
  });

  it("keeps valid slides and rejects bad slide input as a whole section", () => {
    const slides = [{ imageUrl: "https://cdn.example.com/a.png", alt: "Store", caption: "Fashion" }];
    expect(parseLanding({ hero: { ...DEFAULT_LANDING.hero, slides, slideInterval: 7, autoplay: false } }).hero).toMatchObject({ slides, slideInterval: 7, autoplay: false });
    expect(parseLanding({ hero: { ...DEFAULT_LANDING.hero, slides: [{ imageUrl: "javascript:alert(1)", alt: "", caption: "" }] } }).hero).toEqual(DEFAULT_LANDING.hero);
    expect(parseLanding({ hero: { ...DEFAULT_LANDING.hero, slideInterval: 0 } }).hero).toEqual(DEFAULT_LANDING.hero);
    expect(validateLanding({ ...DEFAULT_LANDING, hero: { ...DEFAULT_LANDING.hero, slides: Array(9).fill(slides[0]) } }).ok).toBe(false);
  });

  it("upgrades plain-string trust chips to {label, icon, color}", () => {
    const trust = parseLanding({ trust: { enabled: true, title: "Built for India", chips: ["Fashion", "Pet Supplies", "Kites"] } }).trust;
    expect(trust.chips).toEqual([
      { label: "Fashion", icon: "shirt", color: "pink" },
      { label: "Pet Supplies", icon: "paw-print", color: "orange" },
      { label: "Kites", icon: "tag", color: chipFromLabel("Kites", 2).color },
    ]);
  });

  it("accepts mixed string and object chips, and falls back on an unknown icon or colour", () => {
    const chips = ["Books", { label: "Tea", icon: "coffee", color: "teal" }];
    expect(parseLanding({ trust: { enabled: true, title: "", chips } }).trust.chips[1]).toEqual({ label: "Tea", icon: "coffee", color: "teal" });
    expect(parseLanding({ trust: { enabled: true, title: "", chips: [{ label: "x", icon: "nope", color: "teal" }] } }).trust).toEqual(DEFAULT_LANDING.trust);
    expect(parseLanding({ trust: { enabled: true, title: "", chips: [{ label: "x", icon: "gem", color: "black" }] } }).trust).toEqual(DEFAULT_LANDING.trust);
  });

  it("converts categories saved as chips into items with icons and empty links", () => {
    const categories = parseLanding({ categories: { enabled: true, title: "Every business", body: "", chips: ["Jewellery", "Toys"] } }).categories;
    expect(categories.title).toBe("Every business");
    expect(categories.items).toEqual([
      { label: "Jewellery", icon: "gem", color: "purple", href: "", imageUrl: "" },
      { label: "Toys", icon: "toy-brick", color: "rose", href: "", imageUrl: "" },
    ]);
  });

  it("validates category links and images, falling back when unsafe", () => {
    const item = { label: "Fashion", icon: "shirt", color: "pink", href: "/themes", imageUrl: "https://cdn.example.com/f.jpg" };
    expect(parseLanding({ categories: { ...DEFAULT_LANDING.categories, items: [item] } }).categories.items).toEqual([item]);
    expect(parseLanding({ categories: { ...DEFAULT_LANDING.categories, items: [{ ...item, href: "javascript:x" }] } }).categories).toEqual(DEFAULT_LANDING.categories);
    expect(parseLanding({ categories: "broken" }).categories).toEqual(DEFAULT_LANDING.categories);
  });

  it("defaults solution cards without a colour to auto", () => {
    const items = DEFAULT_LANDING.solutions.items.map(({ color: _c, ...rest }) => rest);
    const solutions = parseLanding({ solutions: { ...DEFAULT_LANDING.solutions, items } }).solutions;
    expect(solutions.items.every((i) => i.color === "auto")).toBe(true);
    expect(parseLanding({ solutions: { ...DEFAULT_LANDING.solutions, items: [{ ...items[0], color: "rose" }] } }).solutions.items[0]?.color).toBe("rose");
  });

  it("ships the 15 default business categories, each with an icon of its own", () => {
    const items = DEFAULT_LANDING.categories.items;
    expect(items).toHaveLength(15);
    expect(items.filter((c) => c.icon === "tag")).toEqual([]);
  });

  it("survives a save → reload round trip unchanged", () => {
    const saved = validateLanding(JSON.parse(JSON.stringify(DEFAULT_LANDING)));
    expect(saved.ok).toBe(true);
    if (saved.ok) expect(parseLanding(JSON.parse(JSON.stringify(saved.value)))).toEqual(DEFAULT_LANDING);
  });
});
