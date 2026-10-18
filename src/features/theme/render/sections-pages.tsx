import Link from "next/link";
import type { ReactNode } from "react";
import type { SectionSettings } from "@/features/theme/sections/definitions";
import { EMAIL_RE, parseMapsEmbedUrl } from "@/features/theme/sections/definitions-pages";
import { isSafeHref } from "@/features/theme/schema/primitives";
import { listBlogPosts } from "@/features/storefront/server/content";
import { StoreImage } from "@/features/storefront/components/store-image";
import { formatAddress, telHref, whatsappUrl } from "@/features/storefront/store-profile";
import { paths } from "@/features/storefront/urls";
import { Cta, Intro } from "./parts";
import { stockFor } from "./variants";
import type { RenderContext } from "./context";

/**
 * Renderers for the page sections (definitions in sections/definitions-pages.ts). Server
 * components; every value is rendered as text or passed through the same validated primitives
 * (hrefs re-checked with isSafeHref, the map URL rebuilt by parseMapsEmbedUrl).
 */

type PageSectionType = "ContactInfo" | "RichText" | "BlogPosts" | "Gallery" | "Team" | "CallToAction";
type P<T extends PageSectionType> = { s: SectionSettings<T>; ctx: RenderContext };

const COLS: Record<number, string> = {
  2: "@[48rem]:grid-cols-2",
  3: "@[48rem]:grid-cols-2 @[64rem]:grid-cols-3",
  4: "@[48rem]:grid-cols-3 @[64rem]:grid-cols-4",
  5: "@[48rem]:grid-cols-3 @[64rem]:grid-cols-5",
};
const MASONRY_COLS: Record<number, string> = { 2: "columns-2", 3: "columns-2 @[64rem]:columns-3", 4: "columns-2 @[48rem]:columns-3 @[64rem]:columns-4", 5: "columns-2 @[48rem]:columns-3 @[64rem]:columns-5" };
const RAIL_ITEM: Record<number, string> = { 2: "w-[80%] @[48rem]:w-[48%]", 3: "w-[75%] @[48rem]:w-[40%] @[64rem]:w-[31%]", 4: "w-[70%] @[48rem]:w-[31%] @[64rem]:w-[23.5%]", 5: "w-[65%] @[48rem]:w-[31%] @[64rem]:w-[18.6%]" };
const RATIO: Record<string, string> = { square: "aspect-square", portrait: "aspect-[3/4]", landscape: "aspect-[4/3]" };

/** Internal path → next/link; https → new tab. Anything else renders its children unlinked. */
function SmartLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  if (!href || !isSafeHref(href)) return <span className={className}>{children}</span>;
  if (href.startsWith("https://")) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

/** Plain text → paragraphs (blank line = new paragraph; single line breaks kept). */
function Paragraphs({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      {parts.map((p, i) => (
        <p key={i} className="whitespace-pre-line leading-relaxed">
          {p}
        </p>
      ))}
    </div>
  );
}

const ICON_PATHS = {
  phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z",
  mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z M22 6l-10 7L2 6",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 6v6l4 2",
  chat: "M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z",
};
function Icon({ name, className = "size-5" }: { name: keyof typeof ICON_PATHS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

// -----------------------------------------------------------------------------
// ContactInfo
// -----------------------------------------------------------------------------

type ContactItem = { key: string; icon: keyof typeof ICON_PATHS; label: string; value: string; href: string | null; external?: boolean };

function contactItems(s: SectionSettings<"ContactInfo">, ctx: RenderContext): { items: ContactItem[]; mail: string | null; wa: string | null } {
  const store = ctx.sf.store;
  const phone = s.phone || store.phone || "";
  const email = s.email || store.email || "";
  const mail = email && EMAIL_RE.test(email) ? `mailto:${email}` : null;
  const waBase = whatsappUrl(store.whatsapp);
  const wa = waBase ? `${waBase}${s.whatsappMessage ? `?text=${encodeURIComponent(s.whatsappMessage)}` : ""}` : null;
  const address = s.address || formatAddress(store.address).join(", ");
  const items: ContactItem[] = [];
  if (s.showPhone && phone) items.push({ key: "phone", icon: "phone", label: "Phone", value: phone, href: telHref(phone) });
  if (s.showEmail && email) items.push({ key: "email", icon: "mail", label: "Email", value: email, href: mail });
  if (s.showWhatsapp && wa) items.push({ key: "wa", icon: "chat", label: "WhatsApp", value: "Chat with us", href: wa, external: true });
  if (s.showAddress && address) items.push({ key: "address", icon: "pin", label: "Address", value: address, href: null });
  if (s.hours) items.push({ key: "hours", icon: "clock", label: "Hours", value: s.hours, href: null });
  return { items, mail, wa };
}

function ItemValue({ it }: { it: ContactItem }) {
  if (!it.href) return <span className="whitespace-pre-line">{it.value}</span>;
  return (
    <a href={it.href} className="sf-link break-words" {...(it.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {it.value}
    </a>
  );
}

function ContactButtons({ s, mail, wa, center }: { s: SectionSettings<"ContactInfo">; mail: string | null; wa: string | null; center?: boolean }) {
  const showMail = (s.buttons === "both" || s.buttons === "email") && mail;
  const showWa = (s.buttons === "both" || s.buttons === "whatsapp") && wa;
  if (!showMail && !showWa) return null;
  return (
    <div className={`flex flex-wrap gap-3 ${center ? "justify-center" : ""}`}>
      {showMail ? (
        <a href={mail} className="sf-btn">
          <Icon name="mail" className="size-4" /> Email us
        </a>
      ) : null}
      {showWa ? (
        <a href={wa} target="_blank" rel="noopener noreferrer" className={showMail ? "sf-btn sf-btn-outline" : "sf-btn"}>
          <Icon name="chat" className="size-4" /> WhatsApp us
        </a>
      ) : null}
    </div>
  );
}

const MAP_H: Record<string, string> = { small: "h-64", medium: "h-80 @[64rem]:h-96", large: "h-96 @[64rem]:h-[32rem]" };

function MapEmbed({ url, height, className = "" }: { url: string; height: string; className?: string }) {
  const src = parseMapsEmbedUrl(url);
  if (!src) return null;
  return (
    <div className={`overflow-hidden rounded-[var(--sf-radius-card)] sf-border border ${MAP_H[height] ?? MAP_H.medium} ${className}`}>
      <iframe
        src={src}
        title="Map"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        className="size-full border-0"
      />
    </div>
  );
}

function ContactInfo({ s, ctx }: P<"ContactInfo">) {
  const { items, mail, wa } = contactItems(s, ctx);
  const intro = { eyebrow: s.eyebrow, heading: s.heading, subheading: s.subheading };
  const empty = !items.length && !s.mapUrl;
  if (empty && !ctx.sf.preview) return null;
  const note = empty ? <p className="sf-muted text-sm">Add your phone, email and address in Settings → Store details, or type them into this section.</p> : null;

  if (s.variant === "contact-split") {
    return (
      <section className={`sf-tone-${s.tone}`}>
        <div className="sf-container sf-section grid items-start gap-10 @[48rem]:grid-cols-2">
          <div className="space-y-6">
            <Intro {...intro} />
            {note}
            <ul className="space-y-5">
              {items.map((it) => (
                <li key={it.key} className="flex gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--sf-accent)_14%,transparent)] text-[var(--sf-accent)]">
                    <Icon name={it.icon} />
                  </span>
                  <span className="min-w-0 space-y-0.5">
                    <span className="sf-eyebrow block">{it.label}</span>
                    <ItemValue it={it} />
                  </span>
                </li>
              ))}
            </ul>
            <ContactButtons s={s} mail={mail} wa={wa} />
          </div>
          {s.mapUrl ? <MapEmbed url={s.mapUrl} height={s.mapHeight} /> : null}
        </div>
      </section>
    );
  }

  if (s.variant === "contact-minimal") {
    return (
      <section className={`sf-tone-${s.tone}`}>
        <div className="sf-container sf-section mx-auto max-w-2xl space-y-8 text-center">
          <div className="space-y-2">
            {s.eyebrow ? <p className="sf-eyebrow">{s.eyebrow}</p> : null}
            {s.heading ? <h2 className="sf-heading text-3xl @[64rem]:text-4xl">{s.heading}</h2> : null}
            {s.subheading ? <p className="sf-muted">{s.subheading}</p> : null}
          </div>
          {note}
          <dl className="sf-border divide-y divide-[var(--sf-border)] border-y">
            {items.map((it) => (
              <div key={it.key} className="flex flex-col items-center gap-1 py-4 @[48rem]:flex-row @[48rem]:justify-between @[48rem]:text-left">
                <dt className="sf-muted flex items-center gap-2 text-sm">
                  <Icon name={it.icon} className="size-4" /> {it.label}
                </dt>
                <dd className="@[48rem]:text-right">
                  <ItemValue it={it} />
                </dd>
              </div>
            ))}
          </dl>
          <ContactButtons s={s} mail={mail} wa={wa} center />
          {s.mapUrl ? <MapEmbed url={s.mapUrl} height={s.mapHeight} /> : null}
        </div>
      </section>
    );
  }

  // contact-cards (default)
  return (
    <section className={`sf-tone-${s.tone}`}>
      <div className="sf-container sf-section space-y-8">
        <Intro {...intro} />
        {note}
        {items.length ? (
          <ul className={`grid gap-4 ${items.length >= 4 ? "@[48rem]:grid-cols-2 @[64rem]:grid-cols-4" : items.length === 3 ? "@[48rem]:grid-cols-3" : "@[48rem]:grid-cols-2"}`}>
            {items.map((it) => (
              <li key={it.key} className="sf-border flex flex-col gap-3 rounded-[var(--sf-radius-card)] border p-6">
                <span className="grid size-11 place-items-center rounded-full bg-[color-mix(in_srgb,var(--sf-accent)_14%,transparent)] text-[var(--sf-accent)]">
                  <Icon name={it.icon} />
                </span>
                <span className="sf-eyebrow">{it.label}</span>
                <ItemValue it={it} />
              </li>
            ))}
          </ul>
        ) : null}
        <ContactButtons s={s} mail={mail} wa={wa} />
        {s.mapUrl ? <MapEmbed url={s.mapUrl} height={s.mapHeight} /> : null}
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// RichText
// -----------------------------------------------------------------------------

function RichText({ s }: P<"RichText">) {
  if (!s.heading && !s.body) return null;
  const heading = s.heading ? <h2 className="sf-heading text-3xl @[64rem]:text-4xl">{s.heading}</h2> : null;
  const head = (
    <div className="space-y-2">
      {s.eyebrow ? <p className="sf-eyebrow">{s.eyebrow}</p> : null}
      {heading}
      {s.subheading ? <p className="sf-muted text-lg">{s.subheading}</p> : null}
    </div>
  );
  const body = s.body ? <Paragraphs text={s.body} /> : null;
  const cta = <Cta label={s.ctaLabel} href={s.ctaHref} />;

  if (s.variant === "richtext-columns") {
    return (
      <section className={`sf-tone-${s.tone}`}>
        <div className="sf-container sf-section grid gap-8 @[48rem]:grid-cols-[2fr_3fr] @[48rem]:gap-16">
          {head}
          <div className="space-y-6">
            {body}
            {cta}
          </div>
        </div>
      </section>
    );
  }
  if (s.variant === "richtext-boxed") {
    return (
      <section className={`sf-tone-${s.tone}`}>
        <div className="sf-container sf-section">
          <div className="sf-border mx-auto max-w-3xl space-y-6 rounded-[var(--sf-radius-card)] border bg-[var(--sf-surface)] p-8 @[64rem]:p-12">
            {head}
            {body}
            {cta}
          </div>
        </div>
      </section>
    );
  }
  const centered = s.variant === "richtext-centered";
  return (
    <section className={`sf-tone-${s.tone}`}>
      <div className={`sf-container sf-section mx-auto max-w-3xl space-y-6 ${centered ? "text-center" : ""}`}>
        {head}
        {body}
        {cta}
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// BlogPosts
// -----------------------------------------------------------------------------

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" }) : null);

async function BlogPosts({ s, ctx }: P<"BlogPosts">) {
  const preview = ctx.sf.preview;
  if (!ctx.sf.features.blog) {
    return preview ? (
      <section className="sf-container sf-section">
        <p className="sf-muted text-sm">Blog posts appear here once the blog is turned on and has posts.</p>
      </section>
    ) : null;
  }
  const { posts } = await listBlogPosts(ctx.sf.tenant.tenantId, 1, s.limit);
  if (!posts.length) {
    return preview ? (
      <section className="sf-container sf-section">
        <Intro eyebrow={s.eyebrow} heading={s.heading} subheading={s.subheading} />
        <p className="sf-muted text-sm">No blog posts yet. Write one in Content → Blog.</p>
      </section>
    ) : null;
  }
  const viewAll = s.viewAllLabel ? (
    <Link href={paths.blog()} className="sf-link text-sm">
      {s.viewAllLabel} →
    </Link>
  ) : undefined;
  const intro = <Intro eyebrow={s.eyebrow} heading={s.heading} subheading={s.subheading} action={viewAll} />;
  const meta = (p: (typeof posts)[number]) => (s.showDate && p.publishedAt ? <p className="sf-eyebrow">{fmtDate(p.publishedAt)}</p> : null);
  const cover = (p: (typeof posts)[number], i: number, ratio: string, sizes: string) => (
    <div className={`relative ${ratio} overflow-hidden rounded-[var(--sf-radius-card)]`}>
      <StoreImage path={p.coverPath} alt="" sizes={sizes} stock={stockFor(ctx, p.coverPath, "story", i)} className="transition group-hover:scale-105" />
    </div>
  );

  if (s.variant === "blog-list") {
    return (
      <section className={`sf-tone-${s.tone}`}>
        <div className="sf-container sf-section mx-auto max-w-4xl">
          {intro}
          <ul className="sf-border divide-y divide-[var(--sf-border)] border-y">
            {posts.map((p, i) => (
              <li key={p.id}>
                <Link href={paths.blogPost(p.slug)} className="group grid grid-cols-[6rem_1fr] items-center gap-5 py-5 @[48rem]:grid-cols-[10rem_1fr]">
                  {cover(p, i, "aspect-[4/3]", "160px")}
                  <span className="space-y-1.5">
                    {meta(p)}
                    <span className="sf-heading block text-xl group-hover:underline">{p.title}</span>
                    {s.showExcerpt && p.excerpt ? <span className="sf-muted line-clamp-2 block text-sm">{p.excerpt}</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  if (s.variant === "blog-featured" && posts.length > 1) {
    const [first, ...rest] = posts;
    return (
      <section className={`sf-tone-${s.tone}`}>
        <div className="sf-container sf-section">
          {intro}
          <div className="grid gap-8 @[64rem]:grid-cols-[3fr_2fr]">
            <Link href={paths.blogPost(first!.slug)} className="group block space-y-4">
              {cover(first!, 0, "aspect-[16/10]", "(min-width: 1024px) 60vw, 100vw")}
              {meta(first!)}
              <h3 className="sf-heading text-3xl group-hover:underline">{first!.title}</h3>
              {s.showExcerpt && first!.excerpt ? <p className="sf-muted">{first!.excerpt}</p> : null}
            </Link>
            <ul className="space-y-6">
              {rest.map((p, i) => (
                <li key={p.id}>
                  <Link href={paths.blogPost(p.slug)} className="group grid grid-cols-[7rem_1fr] gap-4">
                    {cover(p, i + 1, "aspect-square", "112px")}
                    <span className="space-y-1">
                      {meta(p)}
                      <span className="sf-heading block text-lg group-hover:underline">{p.title}</span>
                      {s.showExcerpt && p.excerpt ? <span className="sf-muted line-clamp-2 block text-sm">{p.excerpt}</span> : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`sf-tone-${s.tone}`}>
      <div className="sf-container sf-section">
        {intro}
        <ul className={`grid gap-8 ${COLS[Math.min(3, Math.max(2, posts.length))]}`}>
          {posts.map((p, i) => (
            <li key={p.id}>
              <Link href={paths.blogPost(p.slug)} className="group block space-y-3">
                {cover(p, i, "aspect-[4/3]", "(min-width: 1024px) 33vw, 100vw")}
                {meta(p)}
                <h3 className="sf-heading text-2xl">{p.title}</h3>
                {s.showExcerpt && p.excerpt ? <p className="sf-muted line-clamp-3 text-sm">{p.excerpt}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Gallery
// -----------------------------------------------------------------------------

function Gallery({ s, ctx }: P<"Gallery">) {
  if (!s.items.length) return null;
  const ratio = RATIO[s.ratio] ?? RATIO.square!;
  const sizes = `(min-width: 1024px) ${Math.round(100 / s.columns)}vw, 50vw`;
  const tile = (it: SectionSettings<"Gallery">["items"][number], i: number, shape: string) => {
    const caption = it.caption && s.captions !== "hidden" ? it.caption : "";
    const media = (
      <div className={`relative overflow-hidden rounded-[var(--sf-radius-card)] ${shape}`}>
        <StoreImage path={it.imagePath} alt={it.alt} sizes={sizes} stock={stockFor(ctx, it.imagePath, "tiles", i)} className={it.href ? "transition group-hover:scale-105" : ""} />
        {caption && s.captions === "overlay" ? (
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-3 pt-10 text-sm font-medium text-white">{caption}</span>
        ) : null}
      </div>
    );
    return (
      <figure>
        {it.href ? (
          <SmartLink href={it.href} className="group block">
            {media}
          </SmartLink>
        ) : (
          media
        )}
        {caption && s.captions === "below" ? <figcaption className="sf-muted mt-2 text-sm">{caption}</figcaption> : null}
      </figure>
    );
  };
  const intro = <Intro eyebrow={s.eyebrow} heading={s.heading} subheading={s.subheading} />;

  if (s.variant === "gallery-masonry") {
    const shapes = ["aspect-[3/4]", "aspect-square", "aspect-[4/5]", "aspect-[4/3]", "aspect-[2/3]"];
    return (
      <section className={`sf-tone-${s.tone}`}>
        <div className="sf-container sf-section">
          {intro}
          <ul className={`${MASONRY_COLS[s.columns] ?? MASONRY_COLS[3]} gap-4 [&>li]:mb-4 [&>li]:break-inside-avoid`}>
            {s.items.map((it, i) => (
              <li key={i}>{tile(it, i, shapes[i % shapes.length]!)}</li>
            ))}
          </ul>
        </div>
      </section>
    );
  }
  if (s.variant === "gallery-carousel") {
    return (
      <section className={`sf-tone-${s.tone}`}>
        <div className="sf-container sf-section">
          {intro}
          <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-3 [scrollbar-width:thin]" aria-label={s.heading || "Gallery"}>
            {s.items.map((it, i) => (
              <li key={i} className={`shrink-0 snap-start ${RAIL_ITEM[s.columns] ?? RAIL_ITEM[3]}`}>
                {tile(it, i, ratio)}
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }
  return (
    <section className={`sf-tone-${s.tone}`}>
      <div className="sf-container sf-section">
        {intro}
        <ul className={`grid grid-cols-2 gap-4 ${COLS[s.columns] ?? COLS[3]}`}>
          {s.items.map((it, i) => (
            <li key={i}>{tile(it, i, ratio)}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Team
// -----------------------------------------------------------------------------

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function Team({ s, ctx }: P<"Team">) {
  if (!s.members.length) return null;
  const intro = <Intro eyebrow={s.eyebrow} heading={s.heading} subheading={s.subheading} />;
  const photo = (m: SectionSettings<"Team">["members"][number], i: number, shape: string) => (
    <div className={`relative overflow-hidden bg-[var(--sf-surface)] ${shape}`}>
      {m.imagePath ? (
        <StoreImage path={m.imagePath} alt={m.name} sizes="(min-width: 1024px) 25vw, 50vw" />
      ) : (
        <span aria-hidden className="sf-heading absolute inset-0 grid place-items-center text-3xl text-[var(--sf-muted)]">
          {initials(m.name) || String(i + 1)}
        </span>
      )}
    </div>
  );
  const name = (m: SectionSettings<"Team">["members"][number], cls: string) =>
    m.href ? (
      <SmartLink href={m.href} className={`${cls} hover:underline`}>
        {m.name}
      </SmartLink>
    ) : (
      <span className={cls}>{m.name}</span>
    );

  if (s.variant === "team-list") {
    return (
      <section className={`sf-tone-${s.tone}`}>
        <div className="sf-container sf-section mx-auto max-w-4xl">
          {intro}
          <ul className="space-y-8">
            {s.members.map((m, i) => (
              <li key={i} className="grid grid-cols-[6rem_1fr] items-start gap-5 @[48rem]:grid-cols-[9rem_1fr] @[48rem]:gap-8">
                {photo(m, i, "aspect-square rounded-[var(--sf-radius-card)]")}
                <div className="space-y-1.5">
                  {name(m, "sf-heading block text-2xl")}
                  {m.role ? <p className="sf-eyebrow">{m.role}</p> : null}
                  {m.bio ? <p className="sf-muted whitespace-pre-line text-sm leading-relaxed">{m.bio}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }
  const circles = s.variant === "team-circles";
  return (
    <section className={`sf-tone-${s.tone}`}>
      <div className="sf-container sf-section">
        {intro}
        <ul className={`grid grid-cols-2 gap-6 ${COLS[s.columns] ?? COLS[3]}`}>
          {s.members.map((m, i) => (
            <li key={i} className={circles ? "flex flex-col items-center gap-2 text-center" : "space-y-3"}>
              {photo(m, i, circles ? "aspect-square w-3/4 max-w-48 rounded-full" : "aspect-[4/5] rounded-[var(--sf-radius-card)]")}
              <div className="space-y-0.5">
                {name(m, "sf-heading block text-lg")}
                {m.role ? <p className="sf-muted text-sm">{m.role}</p> : null}
              </div>
              {m.bio ? <p className="sf-muted whitespace-pre-line text-sm">{m.bio}</p> : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// CallToAction
// -----------------------------------------------------------------------------

function CtaButtons({ s, center }: { s: SectionSettings<"CallToAction">; center?: boolean }) {
  return (
    <div className={`flex flex-wrap gap-3 ${center ? "justify-center" : ""}`}>
      <Cta label={s.ctaLabel} href={s.ctaHref} />
      <Cta label={s.secondaryLabel} href={s.secondaryHref} className="sf-btn sf-btn-outline" />
    </div>
  );
}

function CallToAction({ s, ctx }: P<"CallToAction">) {
  if (!s.heading && !s.text && !s.ctaLabel) return null;
  const copy = (center: boolean, light = false) => (
    <div className={`space-y-4 ${center ? "mx-auto max-w-2xl text-center" : ""}`}>
      {s.eyebrow ? <p className={light ? "text-xs font-semibold uppercase tracking-[0.2em] text-white/80" : "sf-eyebrow"}>{s.eyebrow}</p> : null}
      {s.heading ? <h2 className="sf-heading text-3xl @[64rem]:text-5xl">{s.heading}</h2> : null}
      {s.text ? <p className={`whitespace-pre-line text-lg ${light ? "text-white/85" : "opacity-85"}`}>{s.text}</p> : null}
      <CtaButtons s={s} center={center} />
    </div>
  );

  if (s.variant === "cta-image") {
    return (
      <section className="relative isolate overflow-hidden">
        <StoreImage path={s.imagePath} alt={s.alt} sizes="100vw" stock={stockFor(ctx, s.imagePath, "hero", 1)} className="-z-10" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-black/45" />
        <div className="sf-container sf-section py-20 text-white @[64rem]:py-28">{copy(true, true)}</div>
      </section>
    );
  }
  if (s.variant === "cta-split") {
    return (
      <section className={`sf-tone-${s.tone}`}>
        <div className="grid items-stretch @[48rem]:grid-cols-2">
          <div className="relative min-h-72">
            <StoreImage path={s.imagePath} alt={s.alt} sizes="(min-width: 768px) 50vw, 100vw" stock={stockFor(ctx, s.imagePath, "story", 1)} />
          </div>
          <div className="flex items-center p-8 @[64rem]:p-16">{copy(false)}</div>
        </div>
      </section>
    );
  }
  if (s.variant === "cta-card") {
    return (
      <section className="sf-container sf-section">
        <div className={`sf-tone-${s.tone} rounded-[var(--sf-radius-card)] px-6 py-12 @[64rem]:px-16 @[64rem]:py-16`}>{copy(true)}</div>
      </section>
    );
  }
  return (
    <section className={`sf-tone-${s.tone}`}>
      <div className="sf-container sf-section">{copy(true)}</div>
    </section>
  );
}

/** Registered in ./sections.tsx REGISTRY (spread). */
export const PAGE_SECTION_RENDERERS = { ContactInfo, RichText, BlogPosts, Gallery, Team, CallToAction };
