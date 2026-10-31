import Link from "next/link";
import type { CSSProperties } from "react";
import type { HeaderSettings } from "@/features/theme/schema/tokens";
import type { SectionSettings } from "@/features/theme/sections/definitions";
import type { HeaderStyle } from "@/features/theme/sections/variants";
import type { MenuNode } from "@/features/storefront/urls";
import { assetUrl } from "@/lib/storage/assets";
import { getStoreLogo } from "@/features/storefront/server/logo";
import { formatAddress, telHref, whatsappUrl } from "@/features/storefront/store-profile";
import { paths } from "@/features/storefront/urls";
import type { RenderContext } from "./context";
import { FooterBody, FooterIllustration, isFooterDesign } from "./designs-a";
import { hasCustomLogoPosition, logoImageProps, resolveLogoPositions, splitMenu, type HeaderLayout } from "./logo-layout";
import { BottomNav, CartDrawer, HeaderScrollState, MobileNav, SearchOverlay } from "@/features/storefront/components/header-islands";
import { HeartIcon, UserIcon } from "@/features/storefront/components/icons";
import { CartDrawerContent } from "@/features/cart/components/cart-drawer-content";
import { AnnouncementRotator } from "@/features/storefront/components/announcement-rotator";
import { NewsletterForm } from "@/features/storefront/components/islands";
import { effectiveHeader, isInformative } from "@/features/stores/site-mode";

function headerMenuClass(header: HeaderSettings) {
  const classes: string[] = [];
  if (header.menuFontSize) classes.push("sf-menu-size");
  if (header.menuFontWeight !== "default") classes.push("sf-menu-weight");
  if (header.menuLetterSpacing !== "default") classes.push("sf-menu-tracking");
  if (header.menuTextCase !== "default") classes.push("sf-menu-case");
  if (header.menuTextColor) classes.push("sf-menu-colour");
  return classes.length ? ` ${classes.join(" ")}` : "";
}

function headerMenuStyle(header: HeaderSettings): CSSProperties | undefined {
  const letterSpacings: Partial<Record<HeaderSettings["menuLetterSpacing"], string>> = {
    tight: "-0.02em",
    normal: "0",
    wide: "0.08em",
    wider: "0.14em",
  };
  const letterSpacing = letterSpacings[header.menuLetterSpacing];
  const style: Record<string, string> = {};
  if (header.menuFontSize) style["--sf-menu-size"] = `${header.menuFontSize}px`;
  if (header.menuFontWeight !== "default") style["--sf-menu-weight"] = header.menuFontWeight;
  if (letterSpacing) style["--sf-menu-tracking"] = letterSpacing;
  if (header.menuTextCase !== "default") style["--sf-menu-case"] = header.menuTextCase;
  if (header.menuTextColor) style["--sf-menu-colour"] = header.menuTextColor;
  return Object.keys(style).length ? (style as CSSProperties) : undefined;
}

function MenuLink({ node, className }: { node: MenuNode; className?: string }) {
  if (!node.href) return <span className={className}>{node.title}</span>;
  return node.external ? (
    <a href={node.href} className={className} rel="noopener noreferrer" target="_blank">
      {node.title}
    </a>
  ) : (
    <Link href={node.href} className={className}>
      {node.title}
    </Link>
  );
}

async function Logo({ ctx, layout, headerStyle }: { ctx: RenderContext; layout: HeaderLayout; headerStyle: HeaderStyle }) {
  const h = ctx.sf.theme.header;
  // Optimised file, rendered at exactly the original's size (see features/storefront/server/logo.ts).
  const logo = await getStoreLogo(h.logoPath || ctx.sf.store.logoPath);
  const img = logo ? logoImageProps(h, { aspectRatio: logo.aspectRatio, legacyMaxHeight: 56, positions: resolveLogoPositions(h, layout), headerStyle }) : null;
  return (
    <Link href="/" className="flex items-center gap-2" aria-label={`${ctx.sf.store.name} home`}>
      {logo && img ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo keeps intrinsic ratio; size set by theme (logo-layout.ts)
        <img src={logo.src} alt={h.logoAlt || ctx.sf.store.name} style={img.style} className={img.className} />
      ) : h.showStoreName ? (
        <span className="sf-heading block max-w-[52vw] truncate whitespace-nowrap text-lg @[48rem]:max-w-none @[48rem]:text-2xl">{ctx.sf.store.name}</span>
      ) : null}
    </Link>
  );
}

export function AnnouncementBar({ s }: { s: SectionSettings<"AnnouncementBar">; ctx: RenderContext }) {
  if (!s.messages.length) return null;
  const message = (m: (typeof s.messages)[number], hidden = false) =>
    m.href ? (
      <Link href={m.href} className="underline-offset-2 hover:underline" tabIndex={hidden ? -1 : undefined}>
        {m.text}
      </Link>
    ) : (
      m.text
    );
  if (s.variant === "announce-ticker") {
    // Repeat short lists so one copy is wider than the bar; the second copy is hidden from assistive tech.
    const words = Array.from({ length: Math.max(1, Math.ceil(6 / s.messages.length)) }, () => s.messages).flat();
    const copy = (key: string, hidden: boolean) => (
      <ul key={key} aria-hidden={hidden || undefined} className="flex shrink-0">
        {words.map((m, i) => (
          <li key={i} aria-hidden={(hidden || i >= s.messages.length) || undefined} className="flex shrink-0 items-center gap-8 px-4">
            <span>{message(m, hidden || i >= s.messages.length)}</span>
            <span aria-hidden className="opacity-50">✦</span>
          </li>
        ))}
      </ul>
    );
    return (
      <div className={`sf-tone-${s.tone} sf-marquee py-2 text-xs tracking-wide`} style={{ ["--sf-marquee-duration" as string]: `${words.length * 7}s` }}>
        <div className="sf-marquee-track">
          {copy("a", false)}
          {copy("b", true)}
        </div>
      </div>
    );
  }
  if (s.variant === "announce-split") {
    const [lead, ...rest] = s.messages;
    return (
      <div className={`sf-tone-${s.tone} py-2 text-xs tracking-wide`}>
        <div className="sf-container flex items-center justify-center gap-6 text-center @[48rem]:justify-between @[48rem]:text-left">
          <p className="font-medium">{message(lead!)}</p>
          {rest.length ? (
            <ul className="hidden items-center gap-x-6 opacity-90 @[48rem]:flex">
              {rest.map((m, i) => (
                <li key={i} className="flex items-center gap-6">
                  {i > 0 ? <span aria-hidden className="h-3 w-px bg-current opacity-40" /> : null}
                  {message(m)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    );
  }
  if (s.mode === "rotate") {
    return (
      <div className={`sf-tone-${s.tone} px-2 py-2 text-xs tracking-wide`}>
        <div className="sf-container !px-0">
          <AnnouncementRotator messages={s.messages} />
        </div>
      </div>
    );
  }
  return (
    <div className={`sf-tone-${s.tone} px-4 py-2 text-center text-xs tracking-wide`}>
      <ul className="flex flex-wrap justify-center gap-x-8 gap-y-1">
        {s.messages.map((m, i) => (
          <li key={i}>{m.href ? <Link href={m.href} className="underline-offset-2 hover:underline">{m.text}</Link> : m.text}</li>
        ))}
      </ul>
    </div>
  );
}

/** Large logo (image or text wordmark) with an optional spaced tagline under it. */
async function BrandLockup({ ctx, headerStyle }: { ctx: RenderContext; headerStyle: HeaderStyle }) {
  const h = ctx.sf.theme.header;
  const logo = h.wordmark ? null : await getStoreLogo(h.logoPath || ctx.sf.store.logoPath);
  const positions = resolveLogoPositions(h, "logo-left-nav-center");
  const img = logo ? logoImageProps(h, { aspectRatio: logo.aspectRatio, legacyMaxHeight: 64, positions, headerStyle }) : null;
  // Tagline follows the logo placement (custom placements only; the legacy layout stays left-aligned).
  const align = hasCustomLogoPosition(h) ? `sf-lockup-m-${positions.mobile} sf-lockup-d-${positions.desktop}` : "";
  return (
    <Link href="/" className={align ? `sf-lockup ${align}` : "sf-lockup"} aria-label={`${ctx.sf.store.name} home`}>
      {h.wordmark ? (
        <span className="sf-lockup-wordmark">{h.wordmark}</span>
      ) : logo && img ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo keeps intrinsic ratio; size set by theme (logo-layout.ts)
        <img src={logo.src} alt={h.logoAlt || ctx.sf.store.name} style={img.style} className={img.className} />
      ) : (
        <span className="sf-lockup-wordmark">{ctx.sf.store.name}</span>
      )}
      {h.logoTagline ? <span className="sf-lockup-tagline">{h.logoTagline}</span> : null}
    </Link>
  );
}

function MegaImage({ node }: { node: MenuNode }) {
  const body = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- small menu thumbnails */}
      <img src={assetUrl(node.imagePath)!} alt="" loading="lazy" />
      <span>{node.title}</span>
    </>
  );
  return node.href ? (
    <Link href={node.href} className="sf-mega-image">
      {body}
    </Link>
  ) : (
    <span className="sf-mega-image">{body}</span>
  );
}

/** Inline desktop menu; items with children open a dropdown mega panel on hover or keyboard focus. */
function CenterMenu({ items }: { items: MenuNode[] }) {
  return (
    <nav aria-label="Main" className="sf-cnav">
      <ul className="sf-cnav-list">
        {items.map((n) => (
          <li key={n.id} className={`sf-cnav-item ${n.children.length ? "has-panel" : ""}`}>
            <MenuLink node={n} className={`sf-cnav-link ${n.highlight ? "text-[var(--sf-sale)]" : ""}`} />
            {n.children.length ? (
              <>
                <svg aria-hidden className="sf-cnav-caret" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
                <div className="sf-mega" role="group" aria-label={n.title}>
                  <div className="sf-mega-inner sf-container">
                    <div className="sf-mega-head">
                      <p className="sf-mega-title sf-heading">{n.title}</p>
                      {n.href ? <MenuLink node={{ ...n, title: `Shop all ${n.title}` }} className="sf-mega-all" /> : null}
                    </div>
                    <ul className="sf-mega-cols">
                      {n.children.map((c) => (
                        <li key={c.id}>
                          <MenuLink node={c} className="sf-mega-link" />
                          {c.children.length ? (
                            <ul className="sf-mega-sub">
                              {c.children.map((g) => (
                                <li key={g.id}>
                                  <MenuLink node={g} className="sf-mega-sublink" />
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    {n.children.some((c) => c.imagePath && assetUrl(c.imagePath)) ? (
                      <ul className="sf-mega-images">
                        {n.children
                          .filter((c) => c.imagePath && assetUrl(c.imagePath))
                          .slice(0, 2)
                          .map((c) => (
                            <li key={c.id}>
                              <MegaImage node={c} />
                            </li>
                          ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Opt-in layout "logo-left-nav-center": large logo + tagline, centred menu with mega panels, search and bag with count. */
function HeaderLogoLeftNavCenter({ s, ctx }: { s: SectionSettings<"Header">; ctx: RenderContext }) {
  const h = effectiveHeader(ctx.sf.theme.header, ctx.sf.siteMode);
  const menu = ctx.menus[h.menuHandle]?.items ?? [];
  const popular = menu.filter((n) => n.href && !n.external).slice(0, 8).map((n) => ({ label: n.title, href: n.href! }));
  return (
    <header className={`sf-header sf-header-lnc${headerMenuClass(h)} sf-header-style-${s.style} sf-surface sf-border z-40 border-b ${h.sticky ? "sticky top-0" : ""}`} style={headerMenuStyle(h)}>
      {h.sticky ? <HeaderScrollState /> : null}
      <div className="sf-container sf-header-lnc-row">
        <div className="flex items-center gap-1">
          <MobileNav items={menu} storeName={ctx.sf.store.name} signedIn={ctx.signedIn} showCommerceLinks={!isInformative(ctx.sf.siteMode)} alwaysVisible={s.menuStyle === "drawer"} />
          <BrandLockup ctx={ctx} headerStyle={s.style} />
        </div>
        <div className="sf-header-lnc-nav">{s.menuStyle !== "drawer" && menu.length ? <CenterMenu items={menu} /> : null}</div>
        <div className="flex items-center justify-end gap-1">
          {h.showSearch ? <SearchOverlay popular={popular} autoFocus={!ctx.sf.preview} /> : null}
          {h.showAccount ? (
            <Link href={paths.account()} className="sf-icon-btn hidden @[48rem]:inline-grid" aria-label={ctx.signedIn ? "Your account" : "Sign in"}>
              <UserIcon />
            </Link>
          ) : null}
          {h.showWishlist ? (
            <Link href={paths.wishlist()} className="sf-icon-btn hidden @[48rem]:inline-grid" aria-label="Wishlist">
              <HeartIcon />
            </Link>
          ) : null}
          {h.showCart ? (
            <CartDrawer count={ctx.cartCount} inlineCount>
              <CartDrawerContent tenantId={ctx.sf.tenant.tenantId} />
            </CartDrawer>
          ) : null}
        </div>
      </div>
      {h.bottomNav ? <BottomNav cartCount={ctx.cartCount} signedIn={ctx.signedIn} /> : null}
    </header>
  );
}

/**
 * Header with a seller-chosen logo placement (Theme settings → Header → Logo position). One grid,
 * re-templated per breakpoint in storefront.css (.sf-hdr-*): phones/tablets place the logo left or
 * centre; desktop (64rem+) left, centre with the menu split around it, centre above the menu, or
 * right. Works with every header style (classes sf-header-style-*) and layout (the large-logo
 * layout keeps its lockup and mega-menu dropdowns).
 */
function HeaderPositioned({ s, ctx }: { s: SectionSettings<"Header">; ctx: RenderContext }) {
  const h = effectiveHeader(ctx.sf.theme.header, ctx.sf.siteMode);
  const lnc = s.layout === "logo-left-nav-center";
  const pos = resolveLogoPositions(h, s.layout);
  const menu = ctx.menus[h.menuHandle]?.items ?? [];
  const popular = menu.filter((n) => n.href && !n.external).slice(0, 8).map((n) => ({ label: n.title, href: n.href! }));
  const showMenu = menu.length > 0 && s.menuStyle !== "drawer" && (lnc || s.showInlineMenu);
  const [first, second] = pos.desktop === "center" ? splitMenu(menu) : [menu, []];
  const renderMenu = (items: MenuNode[]) =>
    lnc ? (
      <CenterMenu items={items} />
    ) : (
      <nav aria-label="Main">
        <ul className="flex flex-wrap gap-6 text-sm">
          {items.map((n) => (
            <li key={n.id}>
              <MenuLink node={n} className={`sf-link-quiet ${n.highlight ? "text-[var(--sf-sale)]" : ""}`} />
            </li>
          ))}
        </ul>
      </nav>
    );
  return (
    <header className={`sf-header${lnc ? " sf-header-lnc" : ""}${headerMenuClass(h)} sf-header-style-${s.style} sf-surface sf-border z-40 border-b ${h.sticky ? "sticky top-0" : ""}`} style={headerMenuStyle(h)}>
      {h.sticky ? <HeaderScrollState /> : null}
      <div className={`sf-container sf-hdr-pos sf-hdr-m-${pos.mobile} sf-hdr-d-${pos.desktop} py-2.5 @[64rem]:py-3`}>
        <div className="sf-hdr-start">
          <MobileNav items={menu} storeName={ctx.sf.store.name} signedIn={ctx.signedIn} showCommerceLinks={!isInformative(ctx.sf.siteMode)} alwaysVisible={s.menuStyle === "drawer"} />
        </div>
        <div className="sf-hdr-logo">{lnc ? <BrandLockup ctx={ctx} headerStyle={s.style} /> : <Logo ctx={ctx} layout={s.layout} headerStyle={s.style} />}</div>
        {showMenu && first.length ? <div className="sf-hdr-menu">{renderMenu(first)}</div> : null}
        {showMenu && second.length ? <div className="sf-hdr-menu2">{renderMenu(second)}</div> : null}
        <div className="sf-hdr-icons flex items-center gap-0.5">
          {h.showSearch ? <SearchOverlay popular={popular} autoFocus={!ctx.sf.preview} /> : null}
          {h.showAccount ? (
            <Link href={paths.account()} className="sf-icon-btn hidden @[48rem]:inline-grid" aria-label={ctx.signedIn ? "Your account" : "Sign in"}>
              <UserIcon />
            </Link>
          ) : null}
          {h.showWishlist ? (
            <Link href={paths.wishlist()} className="sf-icon-btn" aria-label="Wishlist">
              <HeartIcon />
            </Link>
          ) : null}
          {h.showCart ? (
            <CartDrawer count={ctx.cartCount} inlineCount={lnc}>
              <CartDrawerContent tenantId={ctx.sf.tenant.tenantId} />
            </CartDrawer>
          ) : null}
        </div>
      </div>
      {h.bottomNav ? <BottomNav cartCount={ctx.cartCount} signedIn={ctx.signedIn} /> : null}
    </header>
  );
}

export function Header({ s, ctx }: { s: SectionSettings<"Header">; ctx: RenderContext }) {
  // Positions left on "auto" keep the original layouts below untouched (old themes render identically).
  // "Logo right" has no original markup: it always uses the positioned grid.
  if (s.layout === "logo-right" || hasCustomLogoPosition(ctx.sf.theme.header)) return <HeaderPositioned s={s} ctx={ctx} />;
  if (s.layout === "logo-left-nav-center") return <HeaderLogoLeftNavCenter s={s} ctx={ctx} />;
  const h = effectiveHeader(ctx.sf.theme.header, ctx.sf.siteMode);
  const menu = ctx.menus[h.menuHandle]?.items ?? [];
  const popular = menu.filter((n) => n.href && !n.external).slice(0, 8).map((n) => ({ label: n.title, href: n.href! }));
  const search = h.showSearch ? <SearchOverlay popular={popular} autoFocus={!ctx.sf.preview} /> : null;
  const icons = (
    <div className="flex items-center gap-0.5">
      {s.layout !== "logo-center" ? search : null}
      {h.showAccount ? (
        <Link href={paths.account()} className="sf-icon-btn hidden @[48rem]:inline-grid" aria-label={ctx.signedIn ? "Your account" : "Sign in"}>
          <UserIcon />
        </Link>
      ) : null}
      {h.showWishlist ? (
        <Link href={paths.wishlist()} className="sf-icon-btn" aria-label="Wishlist">
          <HeartIcon />
        </Link>
      ) : null}
      {h.showCart ? (
        <CartDrawer count={ctx.cartCount}>
          <CartDrawerContent tenantId={ctx.sf.tenant.tenantId} />
        </CartDrawer>
      ) : null}
    </div>
  );
  return (
    <header className={`sf-header${headerMenuClass(h)} sf-header-style-${s.style} sf-surface sf-border z-40 border-b ${h.sticky ? "sticky top-0" : ""}`} style={headerMenuStyle(h)}>
      {h.sticky ? <HeaderScrollState /> : null}
      <div className={`sf-container grid items-center gap-3 py-2.5 @[64rem]:py-3 ${s.layout === "logo-center" ? "grid-cols-[1fr_auto_1fr]" : "grid-cols-[auto_1fr_auto]"}`}>
        <div className="flex items-center gap-0.5">
          <MobileNav items={menu} storeName={ctx.sf.store.name} signedIn={ctx.signedIn} showCommerceLinks={!isInformative(ctx.sf.siteMode)} alwaysVisible={s.menuStyle === "drawer"} />
          {s.layout === "logo-center" ? search : <Logo ctx={ctx} layout={s.layout} headerStyle={s.style} />}
        </div>
        <div className={s.layout === "logo-center" ? "flex justify-center" : "hidden @[64rem]:block"}>
          {s.layout === "logo-center" ? (
            <Logo ctx={ctx} layout={s.layout} headerStyle={s.style} />
          ) : s.showInlineMenu && s.menuStyle !== "drawer" ? (
            <nav aria-label="Main">
              <ul className="flex flex-wrap gap-6 text-sm">
                {menu.map((n) => (
                  <li key={n.id}>
                    <MenuLink node={n} className="sf-link-quiet" />
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
        <div className="flex justify-end">{icons}</div>
      </div>
      {h.bottomNav ? <BottomNav cartCount={ctx.cartCount} signedIn={ctx.signedIn} /> : null}
    </header>
  );
}

export function MegaMenu({ s, ctx }: { s: SectionSettings<"MegaMenu">; ctx: RenderContext }) {
  // A drawer-style header replaces the menu bar on desktop too.
  const headerSection = ctx.sf.theme.layout.header.find((x) => x.type === "Header");
  if ((headerSection?.settings as { menuStyle?: string } | undefined)?.menuStyle === "drawer") return null;
  const items = ctx.menus[s.menuHandle]?.items ?? [];
  if (!items.length) return null;
  const wide = s.variant === "mega-wide";
  const inverted = s.variant === "mega-inverted";
  const header = effectiveHeader(ctx.sf.theme.header, ctx.sf.siteMode);
  const navClass = inverted ? "sf-mega-bar-inverted hidden @[64rem]:block" : `sf-surface sf-border hidden border-b @[64rem]:block${wide ? " relative" : ""}`;
  return (
    <nav aria-label="Main" className={`${navClass}${headerMenuClass(header)}`} style={headerMenuStyle(header)}>
      <ul className={`sf-container flex flex-wrap gap-x-8 text-sm ${inverted ? "justify-start" : "justify-center"} ${s.uppercase ? "uppercase tracking-[0.14em] text-xs" : ""}`}>
        {items.map((n) => (
          <li key={n.id} className={wide ? "group" : "group relative"}>
            <MenuLink node={n} className={`block py-3 ${n.highlight ? (inverted ? "font-semibold underline underline-offset-4" : "text-[var(--sf-sale)]") : ""}`} />
            {n.children.length && wide ? (
              <div className="sf-surface sf-border invisible absolute inset-x-0 top-full z-40 border-y py-8 text-[var(--sf-text)] opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                <div className="sf-container grid grid-cols-[minmax(0,1fr)_auto] gap-10 normal-case tracking-normal">
                  <div>
                    <p className="sf-heading mb-4 text-2xl">{n.title}</p>
                    <ul className="grid grid-cols-4 gap-x-8 gap-y-6">
                      {n.children.map((c) => (
                        <li key={c.id}>
                          <MenuLink node={c} className="sf-link-quiet font-medium" />
                          {c.children.length ? (
                            <ul className="mt-2 space-y-1.5">
                              {c.children.map((g) => (
                                <li key={g.id}>
                                  <MenuLink node={g} className="sf-link-quiet sf-muted" />
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {s.showImages && n.children.some((c) => c.imagePath && assetUrl(c.imagePath)) ? (
                    <ul className="flex gap-4">
                      {n.children
                        .filter((c) => c.imagePath && assetUrl(c.imagePath))
                        .slice(0, 2)
                        .map((c) => (
                          <li key={c.id} className="w-44">
                            <MegaImage node={c} />
                          </li>
                        ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            ) : n.children.length ? (
              <div className={`sf-surface sf-border invisible absolute left-1/2 top-full z-40 w-[min(90vw,640px)] -translate-x-1/2 border p-6 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100${inverted ? " text-[var(--sf-text)]" : ""}`}>
                <ul className="grid grid-cols-3 gap-4 normal-case tracking-normal">
                  {n.children.map((c) => (
                    <li key={c.id}>
                      {s.showImages && c.imagePath && assetUrl(c.imagePath) ? (
                        // eslint-disable-next-line @next/next/no-img-element -- small menu thumbnails
                        <img src={assetUrl(c.imagePath)!} alt="" className="mb-2 aspect-[4/5] w-full object-cover" loading="lazy" />
                      ) : null}
                      <MenuLink node={c} className="sf-link-quiet font-medium" />
                      {c.children.length ? (
                        <ul className="mt-1 space-y-1">
                          {c.children.map((g) => (
                            <li key={g.id}>
                              <MenuLink node={g} className="sf-link-quiet sf-muted" />
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Scalloped jharokha-arch edge (original artwork; colour from the theme accent). */
function ArchBorder() {
  return (
    <svg aria-hidden className="sf-footer-arches" width="100%" height="22" preserveAspectRatio="none">
      <defs>
        <pattern id="sf-arch" width="44" height="22" patternUnits="userSpaceOnUse">
          <path d="M0 22V13a11 11 0 0 1 22 0v9Z M22 22V13a11 11 0 0 1 22 0v9Z" fill="currentColor" />
          <circle cx="11" cy="15" r="2.2" fill="var(--sf-bg)" opacity="0.9" />
          <circle cx="33" cy="15" r="2.2" fill="var(--sf-bg)" opacity="0.9" />
        </pattern>
      </defs>
      <rect width="100%" height="22" fill="url(#sf-arch)" />
    </svg>
  );
}

/** Rajasthani chhatri skyline: domes on pillared pavilions, drawn in code (original artwork). */
function ChhatriSkyline() {
  const pavilions = [
    { x: 40, w: 70, h: 60 },
    { x: 150, w: 110, h: 92 },
    { x: 300, w: 60, h: 48 },
    { x: 400, w: 150, h: 110 },
    { x: 590, w: 80, h: 64 },
    { x: 710, w: 120, h: 96 },
    { x: 870, w: 64, h: 52 },
    { x: 970, w: 140, h: 104 },
    { x: 1150, w: 76, h: 60 },
  ];
  return (
    <svg aria-hidden className="sf-footer-skyline" viewBox="0 0 1260 130" preserveAspectRatio="xMidYMax slice">
      <g fill="currentColor">
        {pavilions.map((p, i) => {
          const base = 130;
          const body = p.h * 0.45;
          const dome = p.h * 0.42;
          const top = base - body;
          const cx = p.x + p.w / 2;
          const cols = Math.max(2, Math.round(p.w / 30));
          return (
            <g key={i}>
              <rect x={p.x} y={top} width={p.w} height={4} />
              {Array.from({ length: cols + 1 }, (_, c) => (
                <rect key={c} x={p.x + (c * (p.w - 6)) / cols} y={top + 4} width={6} height={body - 4} />
              ))}
              <path d={`M${p.x + p.w * 0.12} ${top} Q${p.x + p.w * 0.12} ${top - dome} ${cx} ${top - dome * 1.08} Q${p.x + p.w * 0.88} ${top - dome} ${p.x + p.w * 0.88} ${top} Z`} />
              <rect x={cx - 1.5} y={top - dome * 1.08 - 12} width={3} height={12} />
              <circle cx={cx} cy={top - dome * 1.08 - 13} r={3} />
            </g>
          );
        })}
        <rect x="0" y="126" width="1260" height="4" />
      </g>
    </svg>
  );
}

const PAYMENTS = ["UPI", "Visa", "Mastercard", "RuPay", "Net banking"];

export function Footer({ s, ctx }: { s: SectionSettings<"Footer">; ctx: RenderContext }) {
  const store = ctx.sf.store;
  const address = formatAddress(store.address);
  const wa = whatsappUrl(store.whatsapp);
  const year = new Date().getFullYear();
  const ethnic = s.decor === "ethnic";
  const krishna = s.decor === "krishna";
  const cod = ctx.sf.features.cod && store.cod.enabled;
  return (
    <footer className={`sf-tone-${s.tone} sf-footer relative mt-auto ${ethnic ? "sf-footer-ethnic" : ""} ${krishna ? "sf-footer-krishna" : ""}`}>
      {ethnic ? <ArchBorder /> : null}
      {krishna ? (
        <>
          <span aria-hidden className="sf-motif sf-motif-kadamba sf-footer-vine" />
          <span aria-hidden className="sf-motif sf-motif-peacock sf-footer-feather sf-footer-feather-l" />
          <span aria-hidden className="sf-motif sf-motif-peacock sf-footer-feather sf-footer-feather-r" />
        </>
      ) : null}
      {ethnic ? <div aria-hidden className="sf-footer-pattern" /> : null}
      {s.showNewsletter && s.layout !== "footer-mega" ? (
        <div className="relative border-b border-current/15">
          <div className="sf-container flex flex-col items-start gap-5 py-10 @[64rem]:flex-row @[64rem]:items-center @[64rem]:justify-between">
            <div className="max-w-lg space-y-1">
              <p className="sf-heading text-3xl">{s.newsletterHeading}</p>
              {s.newsletterText ? <p className="text-sm opacity-80">{s.newsletterText}</p> : null}
            </div>
            <div className="sf-footer-newsletter w-full max-w-md">
              <NewsletterForm buttonLabel="Subscribe" />
            </div>
          </div>
        </div>
      ) : null}
      {s.layout === "centered" || s.layout === "minimal" ? (
        <FooterCompact s={s} ctx={ctx} />
      ) : isFooterDesign(s.layout) ? (
        <FooterBody s={s} ctx={ctx} payments={[...PAYMENTS, ...(cod ? ["Cash on delivery"] : [])]} />
      ) : (
      <div className="sf-container relative grid gap-10 py-14 @[48rem]:grid-cols-2 @[64rem]:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <p className="sf-heading text-3xl">{store.name}</p>
          {s.about || store.tagline ? <p className="max-w-sm text-sm leading-relaxed opacity-80">{s.about || store.tagline}</p> : null}
          {s.showSocial && store.social.length ? (
            <ul className="flex flex-wrap gap-2 pt-1">
              {store.social.map((l) => (
                <li key={l.url}>
                  <a href={l.url} rel="noopener noreferrer" target="_blank" className="sf-footer-social">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {s.menuHandles.map((handle) => {
          const menu = ctx.menus[handle];
          if (!menu?.items.length) return null;
          return (
            <nav key={handle} aria-label={menu.title}>
              <p className="sf-footer-title">{menu.title}</p>
              <ul className="space-y-2.5 text-sm">
                {menu.items.map((n) => (
                  <li key={n.id}>
                    <MenuLink node={n} className="sf-footer-link" />
                  </li>
                ))}
              </ul>
            </nav>
          );
        })}
        {s.showContact ? (
          <div className="space-y-2.5 text-sm">
            <p className="sf-footer-title">Get in touch</p>
            {store.email ? (
              <p>
                <a href={`mailto:${store.email}`} className="sf-footer-link">
                  {store.email}
                </a>
              </p>
            ) : null}
            {store.phone && telHref(store.phone) ? (
              <p>
                <a href={telHref(store.phone)!} className="sf-footer-link">
                  {store.phone}
                </a>
              </p>
            ) : null}
            {wa ? (
              <p>
                <a href={wa} rel="noopener noreferrer" target="_blank" className="sf-footer-link">
                  WhatsApp us
                </a>
              </p>
            ) : null}
            {address.length ? <address className="not-italic opacity-75">{address.join(", ")}</address> : null}
          </div>
        ) : null}
      </div>
      )}
      {s.layout === "statement" ? (
        <p aria-hidden className="sf-footer-wordmark sf-heading">
          {store.name}
        </p>
      ) : null}
      {s.decor === "illustration" && s.layout !== "footer-illustrated" ? <FooterIllustration s={s} /> : null}
      {ethnic ? <ChhatriSkyline /> : null}
      {s.layout === "footer-tworow" ? null : (
      <div className="relative border-t border-current/15">
        <div className={`sf-container flex flex-col gap-3 py-5 text-xs @[48rem]:flex-row @[48rem]:items-center ${s.layout === "centered" ? "items-center @[48rem]:justify-center @[48rem]:gap-8" : "@[48rem]:justify-between"}`}>
          <p className="opacity-75">{s.copyright || `© ${year} ${store.name}. All rights reserved.`}</p>
          {s.showPaymentNote ? (
            <ul className="flex flex-wrap gap-1.5" aria-label="Payment methods">
              {[...PAYMENTS, ...(cod ? ["Cash on delivery"] : [])].map((m) => (
                <li key={m} className="sf-footer-pay">
                  {m}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      )}
    </footer>
  );
}

/** Footer body for the "centered" and "minimal" layouts (menus inline instead of columns). */
function FooterCompact({ s, ctx }: { s: SectionSettings<"Footer">; ctx: RenderContext }) {
  const store = ctx.sf.store;
  const links = s.menuHandles.flatMap((h) => ctx.menus[h]?.items ?? []);
  const social = s.showSocial && store.social.length ? (
    <ul className="flex flex-wrap justify-center gap-2">
      {store.social.map((l) => (
        <li key={l.url}>
          <a href={l.url} rel="noopener noreferrer" target="_blank" className="sf-footer-social">
            {l.label}
          </a>
        </li>
      ))}
    </ul>
  ) : null;
  const nav = links.length ? (
    <nav aria-label="Footer">
      <ul className={`flex flex-wrap gap-x-6 gap-y-2 text-sm ${s.layout === "centered" ? "justify-center" : ""}`}>
        {links.map((n) => (
          <li key={n.id}>
            <MenuLink node={n} className="sf-footer-link" />
          </li>
        ))}
      </ul>
    </nav>
  ) : null;
  if (s.layout === "minimal") {
    return (
      <div className="sf-container relative flex flex-col gap-5 py-8 @[64rem]:flex-row @[64rem]:items-center @[64rem]:justify-between">
        <p className="sf-heading text-2xl">{store.name}</p>
        {nav}
        {social}
      </div>
    );
  }
  return (
    <div className="sf-container relative mx-auto flex max-w-3xl flex-col items-center gap-6 py-14 text-center">
      <p className="sf-heading text-4xl">{store.name}</p>
      {s.about || store.tagline ? <p className="max-w-md text-sm leading-relaxed opacity-80">{s.about || store.tagline}</p> : null}
      {nav}
      {s.showContact && (store.email || store.phone) ? (
        <p className="text-sm opacity-80">
          {[store.email, store.phone].filter(Boolean).join("  ·  ")}
        </p>
      ) : null}
      {social}
    </div>
  );
}
