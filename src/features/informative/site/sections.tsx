import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { BOOKING_CATEGORIES } from "../categories";
import type { PageSection } from "../sections";
import type { ThemeConfig } from "../themes/types";
import type { SiteView } from "./view";
import { btnPrimary, btnSecondary, card, container, focusRing, heading, Img, Section, SectionHeading, Stars, telHref, whatsappHref } from "./ui";
import { EnquiryFormIsland } from "./enquiry-form";
import { alignOf, bool, boldSegments, imageUrl, int, items, link, oneOf, s as itemStr, str, wrapperStyle } from "./section-props";

/**
 * The shared section library (docs/informative/PLAN.md §5). Each section takes typed data from the
 * SiteView plus optional string props from the page's section JSON, reads tokens only, and picks a
 * layout variant from the theme. Server components: no client JavaScript.
 */
type P = { theme: ThemeConfig; view: SiteView; section: PageSection; isFirst: boolean };

const text = (props: Record<string, unknown>, key: string, fallback: string | null): string | null => {
  const v = props[key];
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 2000) : fallback;
};
const hid = (s: PageSection) => `s-${s.id}`;

/** SectionHeading props with the editor's eyebrow / subheading / alignment overrides. */
function head(section: PageSection, eyebrow: string | null, title: string, align: "left" | "center" = "left", intro: string | null = null) {
  const p = section.props;
  return {
    id: hid(section),
    eyebrow: str(p, "eyebrow", 60) ?? eyebrow,
    title: str(p, "heading", 160) ?? title,
    intro: str(p, "subheading", 400) ?? intro,
    align: alignOf(p, align),
  };
}

// ---- Hero --------------------------------------------------------------------------------------

function HeroText({ theme, view, section, light }: P & { light?: boolean }) {
  const title = text(section.props, "heading", view.businessName)!;
  const sub = text(section.props, "subheading", view.tagline);
  const glow: CSSProperties | undefined = theme.layout.motif === "neon-glow" ? { textShadow: "0 0 24px var(--if-primary), 0 0 2px var(--if-primary)" } : undefined;
  const contact = view.nav.find((n) => n.label === "Contact")?.href ?? "/contact";
  const servicesHref = view.nav.find((n) => n.label === "Services")?.href ?? "/services";
  const body = str(section.props, "text", 600);
  const eyebrow = str(section.props, "eyebrow", 60);
  const primary = link(section.props, "primaryCta") ?? { label: view.ctaLabel, href: contact };
  const secondary = link(section.props, "secondaryCta") ?? (section.props.secondaryCta === null ? null : { label: "View services", href: servicesHref });
  const center = alignOf(section.props) === "center";
  return (
    <div className={cn("max-w-2xl", center && "mx-auto text-center")}>
      {eyebrow ? <p className={cn("mb-3 text-sm font-semibold tracking-wide uppercase", light ? "text-white/85" : "text-(--if-link)")}>{eyebrow}</p> : null}
      {theme.layout.motif === "gold-rules" ? <span aria-hidden className="mb-6 block h-px w-20 bg-(--if-primary)" /> : null}
      <h1 style={glow} className={cn(heading, "text-4xl leading-tight font-bold sm:text-5xl lg:text-6xl", light && "text-white", theme.layout.motif === "signature" && "italic")}>
        {title}
      </h1>
      {sub ? <p className={cn("mt-4 text-lg sm:text-xl", light ? "text-white/90" : "text-(--if-muted)")}>{sub}</p> : null}
      {body ? <p className={cn("mt-4 whitespace-pre-line", light ? "text-white/85" : "text-(--if-muted)")}>{body}</p> : null}
      <div className={cn("mt-8 flex flex-wrap gap-3", center && "justify-center")}>
        <a href={primary.href} className={btnPrimary}>{primary.label}</a>
        {secondary ? <a href={secondary.href} className={cn(btnSecondary, light ? "text-white" : "text-(--if-text)")}>{secondary.label}</a> : null}
      </div>
    </div>
  );
}

function Mountain() {
  return (
    <svg aria-hidden viewBox="0 0 1440 160" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full text-(--if-bg) sm:h-32">
      <path fill="currentColor" d="M0 160 L0 120 L220 40 L360 100 L560 10 L760 110 L900 60 L1100 130 L1260 70 L1440 120 L1440 160 Z" />
    </svg>
  );
}

const HERO_LAYOUTS = ["split", "fullBleedImage", "typographic", "carousel"] as const;

function Hero(p: P) {
  const { theme, view, section } = p;
  const custom = imageUrl(section.props, "image");
  const img = custom ? { url: custom, alt: str(section.props, "heading", 200) ?? view.businessName, width: 1600, height: 1067 } : view.hero[0];
  switch (oneOf(section.props, "layout", HERO_LAYOUTS) ?? theme.layout.hero) {
    case "fullBleedImage":
      return (
        <section aria-label="Introduction" className="relative isolate flex min-h-[78vh] items-end overflow-hidden px-4 pt-28 pb-16 sm:px-6">
          {img ? <Img src={img.url} alt="" width={img.width} height={img.height} priority className="absolute inset-0 -z-10 h-full w-full object-cover" /> : null}
          <div aria-hidden className="absolute inset-0 -z-10 bg-black/60" />
          <div className={container}>
            <HeroText {...p} light />
          </div>
        </section>
      );
    case "carousel": {
      const palettes = theme.palettes ?? [];
      return (
        <section aria-label="Introduction" className="relative">
          <ul className="flex snap-x snap-mandatory overflow-x-auto motion-safe:scroll-smooth" aria-label="Featured spaces">
            {view.hero.map((h, i) => {
              const pal = palettes[i % Math.max(1, palettes.length)];
              return (
                <li key={h.url} className="relative isolate flex min-h-[72vh] w-full shrink-0 snap-start items-end px-4 pb-14 sm:px-6" style={pal ? ({ "--if-accent": pal.accent } as CSSProperties) : undefined}>
                  <Img src={h.url} alt={i === 0 ? "" : h.alt} width={h.width} height={h.height} priority={i === 0} className="absolute inset-0 -z-10 h-full w-full object-cover" />
                  <div aria-hidden className="absolute inset-0 -z-10 bg-black/60" />
                  <span aria-hidden className="absolute inset-x-0 top-0 h-2 bg-(--if-accent)" />
                  <div className={container}>
                    {i === 0 ? <HeroText {...p} light /> : <p className={cn(heading, "text-3xl font-semibold text-white")}>{pal?.name ?? h.alt}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
          {view.hero.length > 1 ? <p className="sr-only">Scroll sideways to see more.</p> : null}
        </section>
      );
    }
    case "typographic":
      return (
        <section aria-label="Introduction" className={cn("relative isolate overflow-hidden px-4 py-24 sm:px-6 sm:py-32", theme.layout.motif === "gradient" ? "bg-gradient-to-br from-(--if-primary) to-(--if-secondary)" : "bg-(--if-bg)")}>
          {/* Scrim: keeps white text ≥ 4.5:1 across the whole gradient, whatever the seller's colours. */}
          {theme.layout.motif === "gradient" ? <div aria-hidden className="absolute inset-0 -z-10 bg-black/40" /> : null}
          <div className={container}>
            <HeroText {...p} light={theme.layout.motif === "gradient"} />
          </div>
        </section>
      );
    case "split":
    default:
      return (
        <section aria-label="Introduction" className={cn("relative overflow-hidden px-4 py-16 sm:px-6 sm:py-24", theme.layout.motif === "mountain" ? "bg-(--if-secondary)" : "bg-(--if-bg)")}>
          <div className={cn(container, "grid items-center gap-10 md:grid-cols-2")}>
            <HeroText {...p} light={theme.layout.motif === "mountain"} />
            {img ? <Img src={img.url} alt={img.alt} width={img.width} height={img.height} priority className={cn("aspect-[4/3] w-full rounded-(--if-radius) object-cover shadow-(--if-shadow)", theme.layout.motif === "signature" && "aspect-[4/5]")} /> : null}
          </div>
          {theme.layout.motif === "mountain" ? <Mountain /> : null}
        </section>
      );
  }
}

// ---- Content sections --------------------------------------------------------------------------

function About({ theme, view, section }: P) {
  const body = text(section.props, "text", view.about);
  if (!body) return null;
  const custom = imageUrl(section.props, "image");
  const img = custom ? { url: custom, alt: "", width: 1200, height: 900 } : view.gallery[0];
  const imageLeft = oneOf(section.props, "imagePosition", ["left", "right"] as const) === "left";
  return (
    <Section labelledBy={hid(section)} tone="surface">
      <div className="grid items-center gap-10 md:grid-cols-2">
        <div className={cn(imageLeft && "md:order-2")}>
          <SectionHeading {...head(section, "About us", `About ${view.businessName}`)} motif={theme.layout.motif} />
          <p className="text-lg leading-relaxed whitespace-pre-line text-(--if-muted)">{body}</p>
        </div>
        {img ? <Img src={img.url} alt={img.alt} width={img.width} height={img.height} className={cn("aspect-[4/3] w-full rounded-(--if-radius) object-cover", imageLeft && "md:order-1")} /> : null}
      </div>
    </Section>
  );
}

function ServicesGrid({ theme, view, section }: P) {
  const style = theme.layout.servicesStyle;
  const list = view.services.slice(0, int(section.props, "limit", 1, 24) ?? 9);
  if (!list.length) return null;
  const showPrices = bool(section.props, "showPrices") ?? true;
  const more = str(section.props, "ctaLabel", 60);
  const servicesHref = view.nav.find((n) => n.label === "Services")?.href ?? "/services";
  const cardCls = style === "glass" ? "rounded-(--if-radius) border border-white/10 bg-white/5 backdrop-blur" : style === "deck" ? cn(card, "motion-safe:transition-transform hover:-rotate-1 hover:-translate-y-1") : card;
  return (
    <Section labelledBy={hid(section)}>
      <SectionHeading {...head(section, "What we do", "Services")} motif={theme.layout.motif} />
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((s) => (
          <li key={s.id} className={cn(cardCls, "flex flex-col overflow-hidden")}>
            {style === "grid" && s.imageUrl ? <Img src={s.imageUrl} alt="" width={720} height={480} className="aspect-[3/2] w-full object-cover" /> : null}
            <div className="flex flex-1 flex-col gap-2 p-5">
              {s.isSample ? <span className="w-fit rounded-full bg-(--if-bg) px-2 py-0.5 text-xs font-semibold text-(--if-muted)">Sample</span> : null}
              <h3 className={cn(heading, "text-xl font-semibold")}>
                <a href={s.href} className={cn("hover:underline", focusRing)}>{s.name}</a>
              </h3>
              {s.shortDescription ? <p className="text-(--if-muted)">{s.shortDescription}</p> : null}
              {showPrices ? (
                <p className="mt-auto flex flex-wrap gap-x-3 pt-2 text-sm font-semibold">
                  {s.priceText ? <span className="text-(--if-link)">{s.priceText}</span> : null}
                  {s.durationText ? <span className="text-(--if-muted)">{s.durationText}</span> : null}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {more ? (
        <p className="mt-8">
          <a href={servicesHref} className={btnSecondary}>{more}</a>
        </p>
      ) : null}
    </Section>
  );
}

function ServicesList({ theme, view, section }: P) {
  const list = view.services.slice(0, int(section.props, "limit", 1, 24) ?? 24);
  if (!list.length) return null;
  const showPrices = bool(section.props, "showPrices") ?? true;
  const menu = theme.layout.servicesStyle === "menu";
  return (
    <Section labelledBy={hid(section)} tone={menu ? "bg" : "surface"}>
      <SectionHeading {...head(section, menu ? "Menu" : "What we do", menu ? "Service menu" : "Services", menu ? "center" : "left")} motif={theme.layout.motif} />
      <ul className={cn("divide-y divide-(--if-border)", menu && "mx-auto max-w-3xl")}>
        {list.map((s) => (
          <li key={s.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-5">
            <div className="min-w-0 flex-1">
              <h3 className={cn(heading, "text-lg font-semibold")}>
                <a href={s.href} className={cn("hover:underline", focusRing)}>{s.name}</a>
                {s.isSample ? <span className="ml-2 align-middle text-xs font-semibold text-(--if-muted)">(Sample)</span> : null}
              </h3>
              {s.shortDescription ? <p className="text-(--if-muted)">{s.shortDescription}</p> : null}
            </div>
            {menu && showPrices ? <span aria-hidden className="hidden flex-1 border-b border-dotted border-(--if-border) sm:block" /> : null}
            {showPrices ? (
              <p className="text-right text-sm font-semibold">
                {s.priceText ? <span className="block text-(--if-link)">{s.priceText}</span> : null}
                {s.durationText ? <span className="block text-(--if-muted)">{s.durationText}</span> : null}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Highlights({ theme, view, section }: P) {
  const custom = items(section.props, "items", 8, (o) => (itemStr(o, "title", 120) ? { icon: itemStr(o, "icon", 8), title: itemStr(o, "title", 120), text: itemStr(o, "text", 400) } : null));
  const list = custom.length ? custom : view.highlights.map((h) => ({ icon: "", ...h }));
  if (!list.length) return null;
  return (
    <Section labelledBy={hid(section)} tone="surface">
      <SectionHeading {...head(section, "Why choose us", "Why people choose us")} motif={theme.layout.motif} />
      <ul className="grid gap-6 md:grid-cols-3">
        {list.map((h, i) => (
          <li key={`${h.title}-${i}`} className={cn(card, "p-6")}>
            {h.icon ? <span aria-hidden className="mb-3 block text-3xl">{h.icon}</span> : <span aria-hidden className="mb-4 block h-1 w-10 rounded-full bg-(--if-accent)" />}
            <h3 className={cn(heading, "text-lg font-semibold")}>{h.title}</h3>
            <p className="mt-2 text-(--if-muted)">{h.text}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Stats({ theme, view, section }: P) {
  const custom = items(section.props, "items", 6, (o) => (itemStr(o, "value", 20) && itemStr(o, "label", 60) ? { value: itemStr(o, "value", 20), label: itemStr(o, "label", 60) } : null));
  const list = custom.length ? custom : view.stats;
  if (!list.length) return null;
  const strip = theme.layout.motif === "stats-strip" || theme.layout.motif === "gradient";
  return (
    <section aria-labelledby={hid(section)} className={cn("px-4 py-10 sm:px-6", strip ? "bg-(--if-primary) text-(--if-on-primary)" : "bg-(--if-bg)")}>
      <h2 id={hid(section)} className="sr-only">At a glance</h2>
      <dl className={cn(container, "grid grid-cols-1 gap-6 text-center sm:grid-cols-3")}>
        {list.map((s) => (
          <div key={s.label}>
            <dt className={cn("text-sm font-medium", strip ? "opacity-90" : "text-(--if-muted)")}>{s.label}</dt>
            <dd className={cn(heading, "order-first text-4xl font-bold")}>{s.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Team({ theme, view, section }: P) {
  const team = view.team.slice(0, int(section.props, "limit", 1, 24) ?? 24);
  if (!team.length) return null;
  return (
    <Section labelledBy={hid(section)}>
      <SectionHeading {...head(section, "Our people", "Meet the team")} motif={theme.layout.motif} />
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {team.map((m) => (
          <li key={m.name} className={cn(card, "overflow-hidden")}>
            {m.photoUrl ? <Img src={m.photoUrl} alt={`${m.name}${m.role ? `, ${m.role}` : ""}`} width={480} height={480} className="aspect-square w-full object-cover" /> : null}
            <div className="p-5">
              <h3 className={cn(heading, "text-lg font-semibold")}>{m.name}</h3>
              {m.role ? <p className="text-sm font-medium text-(--if-link)">{m.role}</p> : null}
              {m.bio ? <p className="mt-2 text-(--if-muted)">{m.bio}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Gallery({ theme, view: base, section }: P) {
  const view = { ...base, gallery: base.gallery.slice(0, int(section.props, "limit", 1, 30) ?? 30) };
  if (!view.gallery.length) return null;
  const variant = oneOf(section.props, "layout", ["grid", "masonry"] as const) ?? theme.layout.gallery;
  return (
    <Section labelledBy={hid(section)} tone="surface">
      <SectionHeading {...head(section, "Gallery", variant === "beforeAfter" ? "Before & after" : "Our work")} motif={theme.layout.motif} />
      {variant === "masonry" ? (
        <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>li]:mb-4 [&>li]:break-inside-avoid">
          {view.gallery.map((g) => (
            <li key={g.url}>
              <Img src={g.url} alt={g.alt} width={g.width} height={g.height} className="w-full rounded-(--if-radius) object-cover" />
            </li>
          ))}
        </ul>
      ) : variant === "beforeAfter" ? (
        <ul className="grid gap-6 md:grid-cols-3">
          {Array.from({ length: Math.floor(view.gallery.length / 2) }, (_, i) => [view.gallery[i * 2]!, view.gallery[i * 2 + 1]!] as const).map(([a, b]) => (
            <li key={a.url} className="grid grid-cols-2 gap-2">
              {[a, b].map((g, j) => (
                <figure key={g.url}>
                  <Img src={g.url} alt={g.alt} width={400} height={500} className="aspect-[4/5] w-full rounded-(--if-radius) object-cover" />
                  <figcaption className="mt-1 text-center text-xs font-semibold text-(--if-muted) uppercase">{j ? "After" : "Before"}</figcaption>
                </figure>
              ))}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {view.gallery.map((g) => (
            <li key={g.url}>
              <Img src={g.url} alt={g.alt} width={g.width} height={g.height} className="aspect-square w-full rounded-(--if-radius) object-cover" />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Testimonials({ theme, view: base, section }: P) {
  const view = { ...base, testimonials: base.testimonials.slice(0, int(section.props, "limit", 1, 12) ?? 12) };
  if (!view.testimonials.length) return null;
  const variant = oneOf(section.props, "layout", ["cards", "carousel", "quote"] as const) ?? theme.layout.testimonials;
  const title = text(section.props, "heading", "What our clients say")!;
  if (variant === "quote") {
    const [first, ...rest] = view.testimonials;
    return (
      <Section labelledBy={hid(section)}>
        <h2 id={hid(section)} className="sr-only">{title}</h2>
        <figure className="mx-auto max-w-3xl text-center">
          {theme.layout.motif === "gold-rules" ? <span aria-hidden className="mx-auto mb-6 block h-px w-16 bg-(--if-primary)" /> : null}
          <blockquote className={cn(heading, "text-2xl leading-snug sm:text-3xl")}>“{first!.text}”</blockquote>
          <figcaption className="mt-4 text-(--if-muted)">— {first!.authorName}</figcaption>
        </figure>
        {rest.length ? (
          <ul className="mx-auto mt-10 grid max-w-3xl gap-6 sm:grid-cols-2">
            {rest.map((t) => (
              <li key={t.authorName} className="text-center">
                <p className="text-(--if-muted)">“{t.text}”</p>
                <p className="mt-2 text-sm font-semibold">{t.authorName}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>
    );
  }
  const carousel = variant === "carousel";
  return (
    <Section labelledBy={hid(section)} tone="surface">
      <SectionHeading {...head(section, "Testimonials", title)} motif={theme.layout.motif} />
      <ul className={carousel ? "-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 motion-safe:scroll-smooth" : "grid gap-6 md:grid-cols-3"} aria-label={carousel ? "Testimonials, scroll sideways for more" : undefined}>
        {view.testimonials.map((t) => (
          <li key={t.authorName} className={cn(card, "flex flex-col gap-3 p-6", carousel && "w-[85%] shrink-0 snap-start sm:w-[45%] lg:w-[32%]")}>
            <Stars rating={t.rating} />
            <blockquote className="text-(--if-text)">“{t.text}”</blockquote>
            <p className="mt-auto text-sm font-semibold text-(--if-muted)">{t.authorName}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

type Plan = { name: string; price: string; features: string[]; highlighted: boolean; cta: { label: string; href: string } | null };

function Pricing({ theme, view, section }: P) {
  const plans: Plan[] = items(section.props, "items", 6, (o) => {
    const name = itemStr(o, "name", 80);
    const price = itemStr(o, "price", 40);
    if (!name || !price) return null;
    const features = Array.isArray(o.features) ? o.features.filter((f): f is string => typeof f === "string" && !!f.trim()).slice(0, 8).map((f) => f.trim().slice(0, 120)) : [];
    const cta = link({ c: { label: o.ctaLabel, href: o.ctaHref } }, "c");
    return { name, price, features, highlighted: o.highlighted === true, cta };
  });
  if (plans.length) {
    const contact = view.nav.find((n) => n.label === "Contact")?.href ?? "/contact";
    return (
      <Section labelledBy={hid(section)}>
        <SectionHeading {...head(section, "Pricing", "Simple, clear pricing", "center")} motif={theme.layout.motif} />
        <ul className={cn("grid gap-6", plans.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
          {plans.map((pl, i) => (
            <li key={`${pl.name}-${i}`} className={cn(card, "flex flex-col p-6", pl.highlighted && "ring-2 ring-(--if-primary)")}>
              <h3 className={cn(heading, "text-lg font-semibold")}>{pl.name}</h3>
              <p className={cn(heading, "my-4 text-3xl font-bold text-(--if-link)")}>{pl.price}</p>
              {pl.features.length ? (
                <ul className="mb-6 space-y-2 text-(--if-muted)">
                  {pl.features.map((f) => (
                    <li key={f} className="flex gap-2"><span aria-hidden className="text-(--if-link)">✓</span>{f}</li>
                  ))}
                </ul>
              ) : null}
              <a href={pl.cta?.href ?? contact} className={cn(pl.highlighted ? btnPrimary : btnSecondary, "mt-auto justify-center")}>{pl.cta?.label ?? view.ctaLabel}</a>
            </li>
          ))}
        </ul>
      </Section>
    );
  }
  const priced = view.services.filter((s) => s.priceText && s.priceText !== "Price on request").slice(0, 3);
  if (!priced.length) return null;
  return (
    <Section labelledBy={hid(section)}>
      <SectionHeading {...head(section, "Pricing", "Simple, clear pricing", "center")} motif={theme.layout.motif} />
      <ul className="grid gap-6 md:grid-cols-3">
        {priced.map((s, i) => (
          <li key={s.id} className={cn(card, "flex flex-col p-6 text-center", i === 1 && "ring-2 ring-(--if-primary)")}>
            <h3 className={cn(heading, "text-lg font-semibold")}>{s.name}</h3>
            <p className={cn(heading, "my-4 text-3xl font-bold text-(--if-link)")}>{s.priceText}</p>
            {s.durationText ? <p className="text-sm text-(--if-muted)">{s.durationText}</p> : null}
            {s.shortDescription ? <p className="mt-2 text-(--if-muted)">{s.shortDescription}</p> : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Faq({ theme, view, section }: P) {
  const faqs = view.faqs.slice(0, int(section.props, "limit", 1, 30) ?? 30);
  if (!faqs.length) return null;
  return (
    <Section labelledBy={hid(section)} tone="surface">
      <SectionHeading {...head(section, "FAQ", "Frequently asked questions")} motif={theme.layout.motif} />
      <div className={cn("max-w-3xl divide-y divide-(--if-border) border-y border-(--if-border)", alignOf(section.props) === "center" && "mx-auto")}>
        {faqs.map((f) => (
          <details key={f.question} className="group py-4">
            <summary className={cn("flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden", focusRing)}>
              {f.question}
              <span aria-hidden className="text-(--if-link) motion-safe:transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2 text-(--if-muted)">{f.answer}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

function Cta({ view, section }: P) {
  const contact = view.nav.find((n) => n.label === "Contact")?.href ?? "/contact";
  const primary = link(section.props, "primaryCta") ?? { label: view.ctaLabel, href: contact };
  const secondary = link(section.props, "secondaryCta");
  const img = imageUrl(section.props, "image");
  const eyebrow = str(section.props, "eyebrow", 60);
  return (
    <section aria-labelledby={hid(section)} className="relative isolate overflow-hidden bg-(--if-primary) px-4 py-16 text-(--if-on-primary) sm:px-6">
      {img ? (
        <>
          <Img src={img} alt="" width={1600} height={900} className="absolute inset-0 -z-10 h-full w-full object-cover" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-black/60" />
        </>
      ) : null}
      <div className={cn(container, "flex flex-col items-start justify-between gap-6 md:flex-row md:items-center", img && "text-white")}>
        <div>
          {eyebrow ? <p className="mb-2 text-sm font-semibold tracking-wide uppercase opacity-90">{eyebrow}</p> : null}
          <h2 id={hid(section)} className={cn(heading, "text-3xl font-semibold")}>{text(section.props, "heading", "Ready when you are")}</h2>
          <p className="mt-2 opacity-90">{text(section.props, "text", "Tell us what you need and we'll get back to you within a day.")}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href={primary.href} className={cn("inline-flex min-h-11 items-center rounded-(--if-radius) bg-(--if-on-primary) px-6 py-3 font-semibold text-(--if-primary)", focusRing)}>
            {primary.label}
          </a>
          {secondary ? (
            <a href={secondary.href} className={cn("inline-flex min-h-11 items-center rounded-(--if-radius) border border-current px-6 py-3 font-semibold", focusRing)}>
              {secondary.label}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Contact({ theme, view, section }: P) {
  const wa = whatsappHref(view.contact.whatsapp ?? view.contact.phone, view.businessName);
  const tel = telHref(view.contact.phone);
  const showMap = bool(section.props, "showMap") ?? true;
  const showHours = bool(section.props, "showHours") ?? false;
  const mapHref = !showMap ? null : view.contact.mapUrl ?? (view.contact.address || view.contact.city ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(view.contact.address ?? view.contact.city ?? "")}` : null);
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <Section labelledBy={hid(section)}>
      <SectionHeading {...head(section, "Contact", "Get in touch")} motif={theme.layout.motif} />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tel ? (
          <li className={cn(card, "p-5")}>
            <h3 className="font-semibold">Call</h3>
            <a href={tel} className={cn("text-(--if-link) underline-offset-2 hover:underline", focusRing)}>{view.contact.phone}</a>
          </li>
        ) : null}
        {wa ? (
          <li className={cn(card, "p-5")}>
            <h3 className="font-semibold">WhatsApp</h3>
            <a href={wa} target="_blank" rel="noopener noreferrer" data-enquiry-source="WHATSAPP_CLICK" className={cn("text-(--if-link) underline-offset-2 hover:underline", focusRing)}>Message us</a>
          </li>
        ) : null}
        {view.contact.email ? (
          <li className={cn(card, "p-5")}>
            <h3 className="font-semibold">Email</h3>
            <a href={`mailto:${view.contact.email}`} className={cn("break-all text-(--if-link) underline-offset-2 hover:underline", focusRing)}>{view.contact.email}</a>
          </li>
        ) : null}
        {mapHref ? (
          <li className={cn(card, "p-5")}>
            <h3 className="font-semibold">Visit</h3>
            <p className="text-(--if-muted)">{view.contact.address ?? view.contact.city}</p>
            <a href={mapHref} target="_blank" rel="noopener noreferrer" className={cn("text-(--if-link) underline-offset-2 hover:underline", focusRing)}>Open in Maps</a>
          </li>
        ) : null}
      </ul>
      {showHours && view.hours.length ? (
        <dl className={cn(card, "mt-6 grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-1 p-5 text-sm")}>
          {view.hours.map((h) => (
            <div key={h.day} className="contents">
              <dt className="font-semibold">{DAYS[h.day] ?? h.day}</dt>
              <dd className="text-(--if-muted)">{h.closed ? "Closed" : `${h.open} – ${h.close}`}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </Section>
  );
}

/**
 * Enquiry form markup (fields per plan). M3 renders it; M7 wires the server action (honeypot,
 * rate limit, notifications). In previews the fieldset is disabled so nothing can be sent.
 */
function EnquiryForm({ view, section }: P) {
  const showDate = BOOKING_CATEGORIES.includes(view.category);
  if (!view.preview && view.enquiry) {
    const serviceId = typeof section.props.serviceId === "string" ? section.props.serviceId : undefined;
    return (
      <Section id="enquiry" labelledBy={hid(section)} tone="surface">
        <SectionHeading {...head(section, "Enquiry", "Send us an enquiry", "left", str(section.props, "text", 400) ?? "We usually reply within a day.")} />
        <EnquiryFormIsland
          id={hid(section)}
          services={view.services.map((s) => ({ id: s.id, name: s.name }))}
          showDateTime={showDate || view.enquiry.showDateTime}
          defaultServiceId={serviceId}
          source={serviceId ? "SERVICE_PAGE" : "CONTACT_FORM"}
          businessName={view.businessName}
          successMessage={view.enquiry.successMessage}
          privacyHref={view.enquiry.privacyHref}
        />
      </Section>
    );
  }
  const field = "mt-1 block min-h-11 w-full rounded-(--if-radius) border border-(--if-border) bg-(--if-bg) px-3 py-2 text-(--if-text)";
  return (
    <Section labelledBy={hid(section)} tone="surface">
      <SectionHeading {...head(section, "Enquiry", "Send us an enquiry", "left", str(section.props, "text", 400) ?? "We usually reply within a day.")} />
      <form className="max-w-2xl" aria-describedby={view.preview ? `${hid(section)}-note` : undefined}>
        <fieldset disabled={view.preview} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Name<span aria-hidden> *</span><input name="name" required autoComplete="name" className={field} /></label>
          <label className="text-sm font-medium">Phone<span aria-hidden> *</span><input name="phone" required type="tel" autoComplete="tel" inputMode="tel" className={field} /></label>
          <label className="text-sm font-medium">Email<input name="email" type="email" autoComplete="email" className={field} /></label>
          <label className="text-sm font-medium">Service
            <select name="serviceId" className={field} defaultValue="">
              <option value="">Not sure yet</option>
              {view.services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          {showDate ? (
            <>
              <label className="text-sm font-medium">Preferred date<input name="preferredDate" type="date" className={field} /></label>
              <label className="text-sm font-medium">Preferred time<input name="preferredTime" type="time" className={field} /></label>
            </>
          ) : null}
          <label className="text-sm font-medium sm:col-span-2">Message<textarea name="message" rows={4} className={cn(field, "min-h-28")} /></label>
          <div aria-hidden className="hidden">
            <label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off" /></label>
          </div>
          <p className="text-sm text-(--if-muted) sm:col-span-2">By sending this form you agree that {view.businessName} may contact you about your enquiry.</p>
          <div className="sm:col-span-2">
            <button type="submit" className={btnPrimary}>Send enquiry</button>
          </div>
        </fieldset>
        {view.preview ? <p id={`${hid(section)}-note`} className="mt-3 text-sm text-(--if-muted)">{view.formNote ?? "Preview: enquiries can't be sent from this demo."}</p> : null}
      </form>
    </Section>
  );
}

function RichText({ section }: P) {
  const body = text(section.props, "text", null);
  if (!body) return null;
  const title = text(section.props, "heading", null);
  return (
    <Section labelledBy={title ? hid(section) : undefined}>
      <div className={cn("max-w-3xl", alignOf(section.props) === "center" && "mx-auto text-center")}>
        {title ? <h2 id={hid(section)} className={cn(heading, "mb-4 text-3xl font-semibold")}>{title}</h2> : null}
        {body.split(/\n\s*\n/).map((para, i) => (
          <p key={i} className="mb-4 text-lg leading-relaxed whitespace-pre-line text-(--if-muted)">
            {boldSegments(para).map((seg, j) => (seg.bold ? <strong key={j} className="text-(--if-text)">{seg.text}</strong> : <span key={j}>{seg.text}</span>))}
          </p>
        ))}
      </div>
    </Section>
  );
}

const WAVE = (
  <svg aria-hidden viewBox="0 0 1440 60" preserveAspectRatio="none" className="block h-8 w-full text-(--if-surface) sm:h-12">
    <path fill="currentColor" d="M0 30 C240 60 480 0 720 30 C960 60 1200 0 1440 30 L1440 60 L0 60 Z" />
  </svg>
);

const REGISTRY = {
  hero: Hero,
  about: About,
  services_grid: ServicesGrid,
  services_list: ServicesList,
  highlights: Highlights,
  stats: Stats,
  team: Team,
  gallery: Gallery,
  testimonials: Testimonials,
  pricing: Pricing,
  faq: Faq,
  cta: Cta,
  contact: Contact,
  enquiry_form: EnquiryForm,
  rich_text: RichText,
} satisfies Record<PageSection["type"], (p: P) => React.ReactNode>;

/** Renders a page's visible sections in order (unknown types are already dropped by the parser). */
export function SectionList({ theme, view, sections }: { theme: ThemeConfig; view: SiteView; sections: PageSection[] }) {
  const visible = sections.filter((s) => s.visible);
  return (
    <>
      {visible.map((s, i) => {
        const C = REGISTRY[s.type];
        const w = wrapperStyle(s.props);
        return (
          <div key={s.id} data-section={s.type} data-section-id={s.id} style={w.style} className={cn(w.bgImage && "relative isolate", w.className)}>
            {w.bgImage ? (
              <>
                <Img src={w.bgImage} alt="" width={1600} height={900} className="absolute inset-0 -z-10 h-full w-full object-cover" />
                <div aria-hidden className="absolute inset-0 -z-10 bg-black/55" />
              </>
            ) : null}
            {theme.layout.motif === "wave" && i > 0 ? WAVE : null}
            <C theme={theme} view={view} section={s} isFirst={i === 0} />
          </div>
        );
      })}
    </>
  );
}
