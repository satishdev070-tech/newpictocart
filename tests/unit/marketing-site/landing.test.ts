import { describe, expect, it } from "vitest";
import { SHARE_NETWORKS, shareUrl } from "@/features/marketing-site/chrome-content";
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

describe("header mega menu and footer (CMS)", () => {
  // A header/footer as saved before the mega menu, highlight links, extra socials and share existed.
  const legacyHeader = {
    nav: [{ label: "Features", href: "/features" }, { label: "Blog", href: "/blog" }],
    loginLabel: "Sign in",
    loginHref: "/seller/login",
    ctaLabel: "Try it",
    ctaHref: "/seller/register",
  };
  const legacyFooter = {
    tagline: "Hi",
    groups: [{ title: "Legal", links: [{ label: "Privacy", href: "/privacy" }] }],
    socials: { instagram: "https://instagram.com/pictocart", x: "", facebook: "", youtube: "", linkedin: "" },
    whatsapp: "919876543210",
    whatsappMessage: "Hello",
    copyright: "Pictocart.",
  };

  it("defaults reproduce the six mega menu columns and the four footer columns", () => {
    const menu = DEFAULT_LANDING.header.megaMenu;
    expect(menu.trigger).toBe("Features");
    expect(menu.columns.map((c) => c.title)).toEqual(["Sell", "Source", "Design", "Channels", "Operate", "Grow"]);
    expect(menu.columns.every((c) => c.items.length > 0)).toBe(true);
    expect(DEFAULT_LANDING.footer.groups.map((g) => g.title)).toEqual(["Product", "Company", "Resources", "Legal"]);
    expect(DEFAULT_LANDING.footer.groups.flatMap((g) => g.links).filter((l) => l.highlight).map((l) => l.label)).toEqual(["Investors"]);
    expect(DEFAULT_LANDING.footer.share.networks).toEqual([...SHARE_NETWORKS]);
  });

  it("keeps an old header and footer and fills the new fields with defaults", () => {
    const parsed = parseLanding({ header: legacyHeader, footer: legacyFooter });
    expect(parsed.header.nav).toEqual(legacyHeader.nav);
    expect(parsed.header.loginLabel).toBe("Sign in");
    expect(parsed.header.megaMenu).toEqual(DEFAULT_LANDING.header.megaMenu);
    expect(parsed.footer.groups[0]?.links[0]).toEqual({ label: "Privacy", href: "/privacy", highlight: false });
    expect(parsed.footer.socials.instagram).toBe("https://instagram.com/pictocart");
    expect(parsed.footer.socials.threads).toBe("");
    expect(parsed.footer.share).toEqual(DEFAULT_LANDING.footer.share);
    expect(parsed.footer.whatsapp).toBe("919876543210");
    // The filled-in document is valid for saving.
    expect(validateLanding({ ...DEFAULT_LANDING, header: parsed.header, footer: parsed.footer }).ok).toBe(true);
  });

  it("does not share default objects between parses", () => {
    const a = parseLanding({ header: legacyHeader });
    a.header.megaMenu.columns.length = 0;
    expect(parseLanding({ header: legacyHeader }).header.megaMenu.columns).toHaveLength(6);
    expect(DEFAULT_LANDING.header.megaMenu.columns).toHaveLength(6);
  });

  it("rejects unsafe menu links, unknown icons and duplicate share networks on save", () => {
    const menu = DEFAULT_LANDING.header.megaMenu;
    const col = menu.columns[0]!;
    const badLink = { ...col, items: [{ ...col.items[0]!, href: "javascript:alert(1)" }] };
    const r1 = validateLanding({ ...DEFAULT_LANDING, header: { ...DEFAULT_LANDING.header, megaMenu: { ...menu, columns: [badLink] } } });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.errors[0]?.path).toBe("header.megaMenu.columns.0.items.0.href");
    const badIcon = { ...col, items: [{ ...col.items[0]!, icon: "skull" }] };
    expect(validateLanding({ ...DEFAULT_LANDING, header: { ...DEFAULT_LANDING.header, megaMenu: { ...menu, columns: [badIcon] } } }).ok).toBe(false);
    const share = { ...DEFAULT_LANDING.footer.share, networks: ["x", "x"] };
    expect(validateLanding({ ...DEFAULT_LANDING, footer: { ...DEFAULT_LANDING.footer, share } }).ok).toBe(false);
  });

  it("falls back to the default header when the stored menu is broken", () => {
    const parsed = parseLanding({ header: { ...legacyHeader, megaMenu: { enabled: "yes" } } });
    expect(parsed.header).toEqual(DEFAULT_LANDING.header);
  });
});

describe("share links", () => {
  const url = "https://pictocart.in/";
  it("builds an encoded link per network", () => {
    expect(shareUrl("whatsapp", url, "Try this")).toBe("https://wa.me/?text=Try%20this%20https%3A%2F%2Fpictocart.in%2F");
    expect(shareUrl("facebook", url, "x")).toBe("https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fpictocart.in%2F");
    expect(shareUrl("x", url, "")).toBe("https://twitter.com/intent/tweet?url=https%3A%2F%2Fpictocart.in%2F");
    expect(shareUrl("email", url, "Hi")).toBe("mailto:?subject=Hi&body=Hi%0A%0Ahttps%3A%2F%2Fpictocart.in%2F");
    expect(shareUrl("copy", url, "Hi")).toBeNull();
    for (const n of SHARE_NETWORKS.filter((n) => n !== "copy")) expect(shareUrl(n, url, "a&b")).not.toContain("a&b");
  });
});
