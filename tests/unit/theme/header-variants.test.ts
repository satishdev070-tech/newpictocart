import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, type ReactNode } from "react";
import { prerender } from "react-dom/static";
import { describe, expect, it, vi } from "vitest";

// Header islands are client components (dialogs, router hooks): render them as plain markers.
vi.mock("@/features/storefront/components/header-islands", () => ({
  BottomNav: () => null,
  HeaderScrollState: () => null,
  MobileNav: () => createElement("button", { "data-mobile-nav": "" }),
  SearchOverlay: () => createElement("button", { "data-search": "" }),
  CartDrawer: ({ children }: { children: ReactNode }) => createElement("button", { "data-cart": "" }, children),
}));
vi.mock("@/features/cart/components/cart-drawer-content", () => ({ CartDrawerContent: () => null }));
vi.mock("@/features/storefront/components/announcement-rotator", () => ({ AnnouncementRotator: () => null }));
vi.mock("@/features/storefront/components/islands", () => ({ NewsletterForm: () => null }));
vi.mock("@/features/theme/render/designs-a", () => ({ FooterBody: () => null, FooterIllustration: () => null, isFooterDesign: () => false }));
vi.mock("@/features/storefront/server/logo", () => ({
  getStoreLogo: async (p: string | null | undefined) => (p ? { src: `https://cdn.test/${p}`, aspectRatio: "4 / 1" } : null),
}));

const { Header } = await import("@/features/theme/render/chrome");
const { headerSettingsSchema } = await import("@/features/theme/schema/tokens");
const { HEADER_STYLES } = await import("@/features/theme/sections/variants");
const { SECTION_DEFINITIONS } = await import("@/features/theme/sections/definitions");
const { BADGE_LOGO, EDITORIAL_LOGO, logoImageProps, resolveLogoPositions } = await import("@/features/theme/render/logo-layout");

type Layout = "logo-left" | "logo-center" | "logo-right" | "logo-left-nav-center";

const menu = ["Home", "Shop", "About", "Blog"].map((title, i) => ({ id: `m${i}`, title, href: `/${title.toLowerCase()}`, external: false, highlight: false, imagePath: null, children: [] }));

function ctx(header: Record<string, unknown>) {
  return {
    sf: {
      theme: { header: headerSettingsSchema.parse({ logoPath: "tenant/56c89401-1365-4ac2-9fde-a188825be0b7/media/logo.png", ...header }), layout: { header: [] } },
      store: { name: "Xolo", logoPath: "tenant/56c89401-1365-4ac2-9fde-a188825be0b7/media/shop-photo.jpg" },
      tenant: { tenantId: "t" },
      siteMode: "store",
    },
    menus: { main: { items: menu } },
    signedIn: false,
    cartCount: 2,
  } as never;
}

async function render(style: string, header: Record<string, unknown> = {}, layout: Layout = "logo-center"): Promise<string> {
  const s = SECTION_DEFINITIONS.Header.schema.parse({ style, layout, showInlineMenu: true });
  const { prelude } = await prerender(createElement(Header, { s, ctx: ctx(header) }));
  return new Response(prelude).text();
}

const headerClass = (html: string) => /<header class="([^"]+)"/.exec(html)?.[1] ?? "";

describe("Header designs", () => {
  it("parses every design and defaults old headers to Classic", () => {
    expect(SECTION_DEFINITIONS.Header.schema.parse({}).style).toBe("classic");
    for (const { value } of HEADER_STYLES) expect(SECTION_DEFINITIONS.Header.schema.parse({ style: value }).style).toBe(value);
  });

  it("renders exactly the chosen design's class, for every layout and logo position", async () => {
    const positions = [{}, { logoPosition: "left" }, { logoPosition: "center" }, { logoPosition: "center-stacked" }, { logoPosition: "right" }, { mobileLogoPosition: "left" }, { mobileLogoPosition: "center" }];
    for (const layout of ["logo-left", "logo-center", "logo-right", "logo-left-nav-center"] as const) {
      for (const pos of positions) {
        const seen = new Set<string>();
        for (const { value } of HEADER_STYLES) {
          const cls = headerClass(await render(value, pos, layout));
          const styles = cls.split(" ").filter((c) => c.startsWith("sf-header-style-"));
          expect(styles, `${layout} ${JSON.stringify(pos)}`).toEqual([`sf-header-style-${value}`]);
          seen.add(cls);
        }
        expect(seen.size).toBe(HEADER_STYLES.length);
      }
    }
  });

  it("has CSS for every design, unlayered so it beats the bar's default utilities", () => {
    const css = readFileSync(path.join(process.cwd(), "src/features/theme/storefront.css"), "utf8");
    const block = css.slice(css.indexOf("/* Header styles"), css.indexOf("/* Footer: statement wordmark */"));
    for (const { value } of HEADER_STYLES) expect(block).toContain(`.sf-header-style-${value}`);
    expect(block).toMatch(/\.sf-header-style-floating > \.sf-container \{[^}]*border-radius: 999px/);
    expect(block).toMatch(/\.sf-header-style-bordered \{[^}]*3px double/);
    expect(block).toMatch(/\.sf-header-style-inverted \{[^}]*background: var\(--sf-primary\)/);
    expect(block).toMatch(/\.sf-header-style-minimal \{[^}]*border-bottom-color: transparent/);
    // Inverted: logo text / lockup and the bag badge stay readable on the primary bar.
    expect(block).toMatch(/\.sf-header-style-inverted \.sf-lockup \{ color: var\(--sf-primary-fg\)/);
    expect(block).toMatch(/\.sf-header-style-inverted \.sf-icon-btn > \.absolute \{[^}]*background: var\(--sf-primary-fg\)/);
    // Not inside an @layer: the closing brace count before the block is balanced.
    const before = css.slice(0, css.indexOf("/* Header styles"));
    expect((before.match(/\{/g) ?? []).length).toBe((before.match(/\}/g) ?? []).length);
  });
});

describe("Header logo position", () => {
  it("keeps the original layout markup while positions are auto", async () => {
    const html = await render("classic", {}, "logo-center");
    expect(html).not.toContain("sf-hdr-pos");
    expect(html).toContain("grid-cols-[1fr_auto_1fr]");
  });

  it("places the logo per breakpoint in every design", async () => {
    for (const { value } of HEADER_STYLES) {
      for (const desktop of ["left", "center", "center-stacked", "right"] as const) {
        for (const mobile of ["left", "center"] as const) {
          const html = await render(value, { logoPosition: desktop, mobileLogoPosition: mobile }, "logo-left");
          expect(html).toContain(`sf-hdr-pos sf-hdr-m-${mobile} sf-hdr-d-${desktop}`);
          expect(html).toContain('class="sf-hdr-logo"');
          expect(html).toContain("data-search");
          expect(html).toContain("data-cart");
          // Centre splits the menu around the logo; other placements keep one menu.
          expect(html.includes("sf-hdr-menu2")).toBe(desktop === "center");
          expect(html).toContain('class="sf-hdr-menu"');
        }
      }
    }
  });

  it("resolves only the desktop or only the mobile position from the layout", async () => {
    expect(await render("classic", { mobileLogoPosition: "left" }, "logo-center")).toContain("sf-hdr-m-left sf-hdr-d-center-stacked");
    expect(await render("classic", { logoPosition: "right" }, "logo-center")).toContain("sf-hdr-m-center sf-hdr-d-right");
  });

  it("uses the header logo (not the store photo) and keeps its proportions", async () => {
    const html = await render("classic", { logoPosition: "left" });
    expect(html).toContain('src="https://cdn.test/tenant/56c89401-1365-4ac2-9fde-a188825be0b7/media/logo.png"');
    expect(html).not.toContain("shop-photo");
    expect(html).toMatch(/class="h-auto w-auto object-contain"/);
    expect(html).toContain("aspect-ratio:4 / 1");
  });

  it("drives the logo size sliders in every design", async () => {
    for (const { value } of HEADER_STYLES.filter((x) => x.value !== "logo-badge")) {
      const html = await render(value, { logoWidth: 240, logoHeight: 80, logoPosition: "right" });
      expect(html).toContain('class="sf-logo-img"');
      expect(html).toContain("--sf-logo-w:240px");
      expect(html).toContain("--sf-logo-h:80px");
      expect(html).toContain("--sf-logo-pos:right center");
    }
  });

  it("gives Editorial an oversized logo while no size is set", async () => {
    const html = await render("editorial", { logoMaxWidth: 160 });
    expect(html).toContain('class="sf-logo-lg"');
    expect(html).toContain(`--sf-logo-max-w:${160 * EDITORIAL_LOGO.widthScale}px`);
    expect(html).toContain(`--sf-logo-max-h:${EDITORIAL_LOGO.height.desktop}px`);
    expect(await render("classic", { logoMaxWidth: 160 })).not.toContain("sf-logo-lg");
  });
});

describe("logoImageProps per header design", () => {
  const positions = { desktop: "left", mobile: "left" } as const;

  it("Editorial enlarges an unsized logo, capped at the max width, and never below the layout's own height", () => {
    const h = headerSettingsSchema.parse({ logoMaxWidth: 320 });
    expect(logoImageProps(h, { legacyMaxHeight: 56, positions, headerStyle: "editorial" })).toEqual({
      className: "sf-logo-lg",
      style: { "--sf-logo-max-w": `${EDITORIAL_LOGO.maxWidth}px`, "--sf-logo-max-h": "96px", "--sf-logo-max-h-m": "56px", aspectRatio: undefined },
    });
    expect(logoImageProps(h, { legacyMaxHeight: 64, positions, headerStyle: "editorial" }).style).toMatchObject({ "--sf-logo-max-h-m": "64px" });
  });

  it("other designs keep the legacy style; a seller-set size wins over Editorial", () => {
    const h = headerSettingsSchema.parse({});
    for (const { value } of HEADER_STYLES.filter((x) => x.value !== "editorial" && x.value !== "logo-badge")) {
      expect(logoImageProps(h, { legacyMaxHeight: 56, positions, headerStyle: value }).className).toBe("h-auto w-auto object-contain");
    }
    const sized = headerSettingsSchema.parse({ logoWidth: 120 });
    expect(logoImageProps(sized, { legacyMaxHeight: 56, positions: resolveLogoPositions(sized, "logo-center"), headerStyle: "editorial" }).className).toBe("sf-logo-img");
  });
});

describe("Header layouts: logo right", () => {
  it("places the logo right on desktop while the logo position is auto", async () => {
    expect(resolveLogoPositions(headerSettingsSchema.parse({}), "logo-right")).toEqual({ desktop: "right", mobile: "left" });
    const html = await render("classic", {}, "logo-right");
    expect(html).toContain("sf-hdr-pos sf-hdr-m-left sf-hdr-d-right");
  });

  it("each layout gives a different desktop placement on auto", () => {
    const h = headerSettingsSchema.parse({});
    expect(["logo-left", "logo-center", "logo-right"].map((l) => resolveLogoPositions(h, l as Layout).desktop)).toEqual(["left", "center-stacked", "right"]);
  });
});

describe("Logo badge header design", () => {
  const positions = { desktop: "left", mobile: "left" } as const;

  it("hangs the whole logo in a tall tab, sized by the sliders when set", () => {
    const h = headerSettingsSchema.parse({});
    expect(logoImageProps(h, { legacyMaxHeight: 56, positions, headerStyle: "logo-badge", aspectRatio: "3 / 4" })).toEqual({
      className: "sf-logo-badge",
      style: { "--sf-badge-h": `${BADGE_LOGO.height.desktop}px`, "--sf-badge-h-m": `${BADGE_LOGO.height.mobile}px`, "--sf-badge-w": `${BADGE_LOGO.maxWidth}px`, aspectRatio: "3 / 4" },
    });
    const sized = headerSettingsSchema.parse({ logoHeight: 180, logoHeightMobile: 90, logoWidth: 200, logoBadgeBg: "primary" });
    const p = logoImageProps(sized, { legacyMaxHeight: 56, positions, headerStyle: "logo-badge" });
    expect(p.className).toBe("sf-logo-badge sf-logo-badge-primary");
    expect(p.style).toMatchObject({ "--sf-badge-h": "180px", "--sf-badge-h-m": "90px", "--sf-badge-w": "200px" });
  });

  it("renders in every layout and has its CSS", async () => {
    for (const layout of ["logo-left", "logo-center", "logo-right", "logo-left-nav-center"] as const) {
      const html = await render("logo-badge", {}, layout);
      expect(html).toContain("sf-header-style-logo-badge");
      expect(html).toContain('class="sf-logo-badge"');
    }
    const css = readFileSync(path.join(process.cwd(), "src/features/theme/storefront.css"), "utf8");
    expect(css).toMatch(/\.sf-logo-badge \{[^}]*object-fit: contain/);
    expect(css).toMatch(/\.sf-logo-badge \{[^}]*margin-bottom: calc\(var\(--sf-badge-row\)/);
  });

  it("old themes parse with no badge background", () => {
    expect(headerSettingsSchema.parse({}).logoBadgeBg).toBe("none");
  });
});
