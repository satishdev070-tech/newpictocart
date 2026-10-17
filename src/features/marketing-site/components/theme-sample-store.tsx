import type { CSSProperties } from "react";
import { Heart, Menu, Search, ShoppingBag, Star, User } from "lucide-react";
import { FONT_STACKS, type FontKey } from "@/features/theme/schema/tokens";
import type { MarketplaceTheme } from "@/features/theme/marketplace/types";
import { industryShort } from "@/features/stores/industries";
import { formatMoney } from "@/lib/money";
import { sampleProducts, sampleStyle } from "../sample-store";

export type SamplePhoto = { url: string; alt: string };

/**
 * A sample storefront drawn from a theme's preset (colours, fonts, header layout, hero, product
 * card, spacing, footer) with industry photos. Used by the on-site theme preview when no live demo
 * store is available. Sized with container queries, so the same markup shows the desktop layout in
 * a wide frame and the mobile layout in the 390 px phone frame. Not interactive (links are inert).
 */
export function ThemeSampleStore({ theme, photos }: { theme: MarketplaceTheme; photos: SamplePhoto[] }) {
  const s = sampleStyle(theme.preset);
  const c = s.colors;
  const heading = FONT_STACKS[s.headingFont as FontKey]?.stack;
  const body = FONT_STACKS[s.bodyFont as FontKey]?.stack;
  const name = theme.name.split(" ")[0]!;
  const products = sampleProducts(theme.industry);
  const hero = photos[0];
  const productPhotos = photos.length > 1 ? photos.slice(1) : photos;
  const h: CSSProperties = { fontFamily: heading, textTransform: s.uppercase ? "uppercase" : "none", letterSpacing: s.uppercase ? "0.06em" : undefined, color: c.text };
  const button = (inverse = false): CSSProperties => {
    const fg = inverse ? c.primary : "#fff";
    const bg = inverse ? "#fff" : c.primary;
    return s.outlineButtons
      ? { border: `1px solid ${inverse ? "#fff" : c.primary}`, color: inverse ? "#fff" : c.primary, background: "transparent", borderRadius: s.buttonRadius }
      : { background: bg, color: fg, border: `1px solid ${bg}`, borderRadius: s.buttonRadius };
  };
  const announcementBg = s.announcement === "accent" ? c.accent : s.announcement === "light" ? c.background : c.primary;
  const footerBg = s.footer === "dark" ? c.primary : s.footer === "muted" ? c.border : c.background;
  const footerFg = s.footer === "dark" ? "#fff" : c.text;
  const sectionTitle = (text: string) => (
    <h2 className="text-2xl @3xl:text-3xl" style={{ ...h, textAlign: s.centerHeadings ? "center" : "left" }}>
      {text}
    </h2>
  );

  return (
    <div className="@container min-h-full select-none" style={{ background: c.background, color: c.text, fontFamily: body }} aria-label={`Sample store in the ${theme.name} theme`}>
      <div className="px-4 py-2 text-center text-[11px] tracking-[0.12em] uppercase" style={{ background: announcementBg, color: s.announcement === "light" ? c.text : "#fff", borderBottom: `1px solid ${c.border}` }}>
        Free shipping across India on orders above ₹999
      </div>

      <header className="sticky top-0 z-10 border-b" style={{ background: c.background, borderColor: c.border }}>
        <div className="relative mx-auto flex max-w-6xl items-center gap-4 px-4 py-4 @3xl:px-8">
          <span className={s.drawerMenu ? "" : "@3xl:hidden"}>
            <Menu aria-hidden className="size-5" />
          </span>
          <span className={`text-2xl ${s.logoCenter ? "absolute left-1/2 -translate-x-1/2" : ""}`} style={{ ...h, color: c.primary }}>
            {name}
          </span>
          {!s.logoCenter && !s.drawerMenu ? (
            <nav className="ml-6 hidden gap-6 text-sm @3xl:flex" style={{ color: c.text }}>
              <span>New in</span>
              <span>Shop all</span>
              <span>Collections</span>
              <span style={{ color: c.sale }}>Sale</span>
            </nav>
          ) : null}
          <span className="ml-auto flex items-center gap-3.5" style={{ color: c.text }}>
            <Search aria-hidden className="size-[18px]" />
            <User aria-hidden className="hidden size-[18px] @md:block" />
            <ShoppingBag aria-hidden className="size-[18px]" />
          </span>
        </div>
        {s.logoCenter && !s.drawerMenu ? (
          <nav className="hidden justify-center gap-8 border-t py-2.5 text-sm @3xl:flex" style={{ borderColor: c.border }}>
            <span>New in</span>
            <span>Shop all</span>
            <span>Collections</span>
            <span style={{ color: c.sale }}>Sale</span>
          </nav>
        ) : null}
      </header>

      <section className="relative isolate flex min-h-[420px] items-center overflow-hidden @3xl:min-h-[520px]" style={{ background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})` }}>
        {hero ? (
          <>
            {/* Pre-sized images.unsplash.com URL. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={hero.url} alt={hero.alt} className="absolute inset-0 -z-10 size-full object-cover" />
            <div className="absolute inset-0 -z-10" style={{ background: s.heroLight ? "rgba(0,0,0,0.38)" : "rgba(255,255,255,0.55)" }} />
          </>
        ) : null}
        <div className={`mx-auto w-full max-w-6xl px-6 py-16 @3xl:px-12 ${s.heroCenter ? "text-center" : ""}`} style={{ color: s.heroLight || !hero ? "#fff" : c.text }}>
          <p className="text-xs tracking-[0.2em] uppercase opacity-90">New season · {industryShort(theme.industry)}</p>
          <h1 className={`mt-3 max-w-xl text-4xl leading-tight @3xl:text-6xl ${s.heroCenter ? "mx-auto" : ""}`} style={{ ...h, color: "inherit" }}>
            {theme.tagline}
          </h1>
          <p className={`mt-4 max-w-md text-sm opacity-90 @3xl:text-base ${s.heroCenter ? "mx-auto" : ""}`}>Handpicked pieces, delivered across India. Cash on delivery and easy returns.</p>
          <span className="mt-7 inline-block px-6 py-3 text-sm font-semibold" style={button(s.heroLight || !hero)}>
            Shop the collection
          </span>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 @3xl:px-8" style={{ paddingTop: s.sectionGap, paddingBottom: s.sectionGap / 2 }}>
        {sectionTitle("Best sellers")}
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 @3xl:grid-cols-3 @5xl:grid-cols-6">
          {products.map((p, i) => {
            const photo = productPhotos.length ? productPhotos[i % productPhotos.length] : null;
            return (
              <li key={p.name} style={{ textAlign: s.cardCenter ? "center" : "left" }}>
                <div className="relative overflow-hidden" style={{ aspectRatio: s.imageRatio, borderRadius: s.cardRadius, background: [c.border, c.secondary, c.accent][i % 3] }}>
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo.url} alt="" loading="lazy" className="size-full object-cover" style={{ objectPosition: `${(i * 23) % 100}% 50%` }} />
                  ) : null}
                  {p.compareAt ? (
                    <span className="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase" style={s.filledBadge ? { background: c.sale, color: "#fff", borderRadius: 3 } : { background: "#fff", color: c.sale }}>
                      Sale
                    </span>
                  ) : null}
                  <Heart aria-hidden className="absolute top-2 right-2 size-4 text-white drop-shadow" />
                </div>
                <p className="mt-3 line-clamp-1 text-sm">{p.name}</p>
                {s.showRating ? (
                  <p className={`mt-1 flex items-center gap-0.5 ${s.cardCenter ? "justify-center" : ""}`} aria-hidden>
                    {Array.from({ length: 5 }, (_, k) => (
                      <Star key={k} className="size-3" style={{ color: c.accent, fill: k < 4 ? c.accent : "none" }} />
                    ))}
                  </p>
                ) : null}
                <p className="mt-1 text-sm font-semibold">
                  <span style={{ color: p.compareAt ? c.sale : c.text }}>{formatMoney(p.price)}</span>
                  {p.compareAt ? <span className="ml-2 text-xs font-normal line-through opacity-60">{formatMoney(p.compareAt)}</span> : null}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 @3xl:grid-cols-2 @3xl:px-8" style={{ paddingTop: s.sectionGap / 2, paddingBottom: s.sectionGap }}>
        <div className="overflow-hidden" style={{ aspectRatio: "4 / 3", borderRadius: s.cardRadius, background: c.border }}>
          {photos[2] ?? hero ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={(photos[2] ?? hero)!.url} alt="" loading="lazy" className="size-full object-cover" />
          ) : null}
        </div>
        <div>
          <p className="text-xs tracking-[0.2em] uppercase" style={{ color: c.accent }}>
            Our story
          </p>
          <h2 className="mt-3 text-3xl" style={h}>
            Made with care, in India
          </h2>
          <p className="mt-4 text-sm leading-relaxed opacity-80">Every piece is sourced from small makers and checked by hand before it ships. Your store&rsquo;s own story, images and products replace this sample text.</p>
          <span className="mt-6 inline-block px-5 py-2.5 text-sm font-semibold" style={button()}>
            Read our story
          </span>
        </div>
      </section>

      <section className="border-y" style={{ borderColor: c.border, background: c.background }}>
        <div className="mx-auto max-w-6xl px-4 py-12 text-center @3xl:px-8">
          <h2 className="text-2xl" style={h}>
            Join the list
          </h2>
          <p className="mt-2 text-sm opacity-75">New drops and offers, once a week.</p>
          <div className="mx-auto mt-5 flex max-w-md gap-2">
            <span className="flex-1 border px-3 py-2.5 text-left text-sm opacity-60" style={{ borderColor: c.border, borderRadius: s.buttonRadius }}>
              Email address
            </span>
            <span className="px-5 py-2.5 text-sm font-semibold" style={button()}>
              Subscribe
            </span>
          </div>
        </div>
      </section>

      <footer style={{ background: footerBg, color: footerFg }}>
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 text-sm @3xl:grid-cols-4 @3xl:px-8">
          <div>
            <p className="text-xl" style={{ ...h, color: footerFg }}>
              {name}
            </p>
            <p className="mt-2 opacity-75">{theme.tagline}</p>
          </div>
          {[
            ["Shop", "New in", "Best sellers", "Sale"],
            ["Help", "Shipping", "Returns", "Contact"],
            ["About", "Our story", "Blog", "FAQ"],
          ].map(([title, ...links]) => (
            <div key={title}>
              <p className="font-semibold">{title}</p>
              <ul className="mt-2 space-y-1.5 opacity-75">
                {links.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}
