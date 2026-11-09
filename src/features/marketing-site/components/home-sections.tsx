import Link from "next/link";
import { ArrowRight, BarChart3, Check, CreditCard, Globe2, LayoutTemplate, PackageSearch, ReceiptText, Truck } from "lucide-react";
import type { MarketplaceTheme } from "@/features/theme/marketplace/types";
import { ThemeMockup } from "@/features/theme/marketplace/mockup";
import { BENEFITS, CATEGORY_CARDS, CTA_CREATE, CTA_THEMES, HERO, HOW_IT_WORKS, SECTION_IDS, SIGNUP_HREF, THEMES_HREF, type BenefitKey, type Faq, type Step } from "../content";
import { themeCountFor, themeForIndustry, themesHref } from "../themes";
import { ButtonLink, Container, Section } from "./ui";
import { ThemeCard, ThemeDevicePreview } from "./theme-card";
import { DESKTOP_VIEWPORT } from "./device-viewports";
import { themeShot } from "../theme-shots";

const BENEFIT_ICONS: Record<BenefitKey, typeof Check> = {
  storefront: LayoutTemplate,
  catalogue: PackageSearch,
  orders: ReceiptText,
  payments: CreditCard,
  shipping: Truck,
  domains: Globe2,
  seo: BarChart3,
};

export function Hero({
  theme,
  previewUrl,
  trialDays,
  freeForever = false,
}: {
  theme: MarketplaceTheme | undefined;
  previewUrl: string | null;
  trialDays: number;
  freeForever?: boolean;
}) {
  const assurances = [
    freeForever ? "Free forever for up to 10 products, no card details" : trialDays > 0 ? `${trialDays}-day free trial, no card details` : "No card details to sign up",
    "UPI and cards through your own payment account, plus COD",
    "Free store address, custom domain on eligible plans",
  ];
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-mk-bg to-mk-elev-1" aria-labelledby="hero-title">
      <Container className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] lg:py-24">
        <div>
          <p className="mk-label inline-flex items-center gap-2 text-mk-accent">
            <span className="size-1.5 rounded-full bg-mk-accent" aria-hidden />
            {HERO.eyebrow}
          </p>
          <h1 id="hero-title" className="mk-display-lg mt-5 text-balance text-mk-text">
            {HERO.headline}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-mk-muted sm:text-xl">{HERO.body}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href={SIGNUP_HREF} size="lg" track={{ id: "create_store", location: "hero" }}>
              {CTA_CREATE} <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
            <ButtonLink href={THEMES_HREF} variant="secondary" size="lg" track={{ id: "explore_themes", location: "hero" }}>
              {CTA_THEMES}
            </ButtonLink>
          </div>
          <ul className="mt-8 grid gap-2.5 text-sm text-mk-text/85">
            {assurances.map((a) => (
              <li key={a} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-mk-accent-tint text-mk-accent" aria-hidden>
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                {a}
              </li>
            ))}
          </ul>
        </div>
        {theme ? (
          <figure className="relative w-full pb-4">
            <div className="absolute -inset-x-4 -top-6 bottom-2 -z-0 rounded-[40px] bg-mk-accent-tint" aria-hidden />
            <div className="relative">
              <ThemeDevicePreview theme={theme} previewUrl={previewUrl} size="large" eager live />
            </div>
            <figcaption className="relative mt-8 text-center text-sm text-mk-muted">
              Shown: the{" "}
              <Link href={`/themes/${theme.key}`} className="font-semibold text-mk-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent">
                {theme.name}
              </Link>{" "}
              theme with sample products{previewUrl ? " (select Live preview to try the demo store)" : ""}.
            </figcaption>
          </figure>
        ) : null}
      </Container>
    </section>
  );
}

export function Benefits() {
  return (
    <Section id={SECTION_IDS.benefits} labelledBy="benefits-title">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mk-label text-mk-accent">Why Pictocart</p>
        <h2 id="benefits-title" className="mk-display-lg mt-4 text-balance text-mk-text">
          Everything you need to sell online
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-mk-muted">Set up a store, take orders and run your business from one dashboard.</p>
      </div>
      <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {BENEFITS.map((b) => {
          const Icon = BENEFIT_ICONS[b.key];
          return (
            <li key={b.key} className="rounded-mk-lg border border-mk-line bg-mk-elev-1 p-6">
              <span className="grid size-11 place-items-center rounded-mk-md bg-mk-elev-2 text-mk-accent" aria-hidden>
                <Icon className="size-5" />
              </span>
              <h3 className="mt-5 font-brand text-lg font-bold text-mk-text">{b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mk-muted">{b.body}</p>
            </li>
          );
        })}
        <li className="flex flex-col justify-between rounded-mk-lg border border-mk-accent/30 bg-mk-accent-tint p-6 text-mk-text">
          <p className="font-brand text-lg font-bold">See every feature in detail</p>
          <Link href="/features" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-mk-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent">
            Explore features <ArrowRight aria-hidden className="size-4" />
          </Link>
        </li>
      </ul>
    </Section>
  );
}

export function Categories() {
  return (
    <Section id={SECTION_IDS.categories} tone="canvas" labelledBy="categories-title">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mk-label text-mk-accent">For every kind of business</p>
        <h2 id="categories-title" className="mk-display-lg mt-4 text-balance text-mk-text">
          Built for more than fashion
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-mk-muted">Themes are designed for different kinds of products, from jewellery to bakeries to electronics.</p>
      </div>
      <ul className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
        {CATEGORY_CARDS.map((c) => {
          const theme = themeForIndustry(c.industry);
          const count = themeCountFor(c.industry);
          return (
            <li key={c.industry}>
              <Link
                href={themesHref({ industry: c.industry as never })}
                className="group block h-full overflow-hidden rounded-mk-lg border border-mk-line bg-mk-elev-1 transition-shadow hover:shadow-brand-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent"
              >
                <div className="overflow-hidden border-b border-mk-line" aria-hidden>
                  {theme ? <CategoryPreview theme={theme} label={c.label} /> : null}
                </div>
                <div className="p-4">
                  <p className="font-brand font-bold text-mk-text group-hover:text-mk-accent">{c.label}</p>
                  <p className="mt-1 text-xs text-mk-muted sm:text-sm">{c.body}</p>
                  {count ? <p className="mt-2 text-xs font-semibold text-mk-accent">{count === 1 ? "1 theme" : `${count} themes`}</p> : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/** Category card image: the theme's screenshot when captured, otherwise its mockup. Never a live store. */
function CategoryPreview({ theme, label }: { theme: MarketplaceTheme; label: string }) {
  const shot = themeShot(theme.key, "desktop");
  return (
    <div className="overflow-hidden" style={{ aspectRatio: `${DESKTOP_VIEWPORT.width} / ${DESKTOP_VIEWPORT.height}`, background: theme.preset.tokens.colors.background }}>
      {shot ? (
        // eslint-disable-next-line @next/next/no-img-element -- static pre-sized WebP, no optimizer needed
        <img src={shot} alt="" width={DESKTOP_VIEWPORT.width} height={DESKTOP_VIEWPORT.height} loading="lazy" decoding="async" className="block size-full object-cover object-top" />
      ) : (
        <ThemeMockup preset={theme.preset} name={label} tagline={theme.tagline} themeKey={theme.key} />
      )}
    </div>
  );
}

export function ThemeShowcase({ themes }: { themes: MarketplaceTheme[] }) {
  return (
    <Section id={SECTION_IDS.themes} labelledBy="themes-title">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="mk-label text-mk-accent">Themes</p>
          <h2 id="themes-title" className="mk-display-lg mt-4 text-balance text-mk-text">
            Start with a design made for your products
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-mk-muted">Preview a theme on a demo store, then use it for your own. Your products and text replace the samples.</p>
        </div>
        <ButtonLink href={THEMES_HREF} variant="secondary" track={{ id: "all_themes", location: "home_themes" }}>
          See all themes <ArrowRight aria-hidden className="size-4" />
        </ButtonLink>
      </div>
      <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((t) => (
          <li key={t.key} className="h-full">
            <ThemeCard theme={t} location="home_themes" />
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function HowItWorksSteps({ steps = HOW_IT_WORKS, headingId = "how-title", compact = false }: { steps?: Step[]; headingId?: string; compact?: boolean }) {
  return (
    <ol className={`mt-12 grid gap-5 ${compact ? "md:grid-cols-5" : "md:grid-cols-2 lg:grid-cols-5"}`} aria-labelledby={headingId}>
      {steps.map((s, i) => (
        <li key={s.title} className="relative rounded-mk-lg border border-mk-line bg-mk-elev-1 p-6">
          <span className="grid size-10 place-items-center rounded-full bg-mk-accent font-brand text-base font-bold text-mk-accent-ink" aria-hidden>
            {i + 1}
          </span>
          <h3 className="mt-4 font-brand text-base font-bold text-mk-text">
            <span className="sr-only">Step {i + 1}: </span>
            {s.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-mk-muted">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}

export function HowItWorks() {
  return (
    <Section id={SECTION_IDS.howItWorks} tone="canvas" labelledBy="how-title">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mk-label text-mk-accent">How it works</p>
        <h2 id="how-title" className="mk-display-lg mt-4 text-balance text-mk-text">
          From sign-up to your first sale
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-mk-muted">Five steps, and your store stays private until you choose to publish it.</p>
      </div>
      <HowItWorksSteps compact />
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <ButtonLink href={SIGNUP_HREF} track={{ id: "create_store", location: "how_it_works" }}>
          {CTA_CREATE}
        </ButtonLink>
        <ButtonLink href="/how-it-works" variant="secondary" track={{ id: "how_it_works_detail", location: "how_it_works" }}>
          Read the full guide
        </ButtonLink>
      </div>
    </Section>
  );
}

export function FaqSection({ faqs, title = "Questions sellers ask" }: { faqs: Faq[]; title?: string }) {
  return (
    <Section id={SECTION_IDS.faq} labelledBy="faq-title">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
        <div className="max-w-xl">
          <p className="mk-label text-mk-accent">FAQ</p>
          <h2 id="faq-title" className="mk-display-lg mt-4 text-balance text-mk-text">
            {title}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-mk-muted">Straight answers about setting up and running your store.</p>
        </div>
        <div className="divide-y divide-mk-line rounded-mk-lg border border-mk-line bg-mk-elev-1">
          {faqs.map((f) => (
            <details key={f.question} className="group px-5 py-1 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded py-4 font-semibold text-mk-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent">
                {f.question}
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-mk-elev-2 text-mk-accent transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="pb-5 text-sm leading-relaxed text-mk-muted">{f.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}

export function FinalCta({ trialDays, freeForever = false }: { trialDays: number; freeForever?: boolean }) {
  return (
    <section className="relative isolate overflow-hidden bg-mk-bg px-4 pb-20 sm:px-6" aria-labelledby="final-cta-title">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-mk-lg border border-mk-line bg-mk-elev-1 px-6 py-14 text-center sm:px-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_20%_0%,rgb(36_207_166/0.16),transparent_70%),radial-gradient(40%_50%_at_90%_100%,rgb(36_207_166/0.1),transparent_70%)]"
        />
        <div className="relative">
          <p className="mk-label text-mk-accent">Get started</p>
          <h2 id="final-cta-title" className="mk-display-lg mx-auto mt-4 max-w-2xl text-balance text-mk-text">
            Ready to open your online store?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-mk-muted">
            {freeForever
              ? "Create your store free forever — up to 10 products, no card needed. "
              : trialDays > 0
                ? `Create your store and try it free for ${trialDays} days. `
                : "Create your store today. "}
            It stays private until you publish.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink href={SIGNUP_HREF} variant="cta" size="lg" track={{ id: "create_store", location: "final_cta" }}>
              {CTA_CREATE}
            </ButtonLink>
            <ButtonLink href={THEMES_HREF} variant="secondary" size="lg" track={{ id: "explore_themes", location: "final_cta" }}>
              {CTA_THEMES}
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
