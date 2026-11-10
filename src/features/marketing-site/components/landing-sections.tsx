import Link from "next/link";
import dynamic from "next/dynamic";
import { preload } from "react-dom";
import { ArrowRight, Check, ChevronRight, Quote, Star } from "lucide-react";
import type { ReactNode } from "react";
import type { MarketplaceTheme } from "@/features/theme/marketplace/types";
import type { CategoryImage } from "@/lib/unsplash";
import { cn } from "@/lib/cn";
import type { MarketingPlan } from "../plans";
import { fillTokens, type LandingContent, type StepVisual } from "../landing";
import { ButtonLink } from "./ui";
import { ACCENT, Highlighted, LandingIconView, tagColor } from "./landing-icons";
import { RotatingWords } from "./rotating-words";
import { HeroSlideshow } from "./hero-slideshow";
import { Reveal } from "./reveal";
import { themeMockupHeroUrl } from "@/features/theme/marketplace/mockup";
import { themeShot } from "../theme-shots";
import { ThemeCard, ThemeDevicePreview } from "./theme-card";
import { WhenVisible } from "./when-visible";
import { StepsStack, StepsStackCard } from "./steps-stack";
import { inferStepMediaKind, type StepMediaKind } from "../landing";

/** Below-fold pricing island — keep the client PricingTable out of the initial home JS. */
const PricingTable = dynamic(() => import("./pricing-table").then((m) => ({ default: m.PricingTable })));

/* eslint-disable @next/next/no-img-element -- CMS images are admin-provided URLs, shown as-is */

type Tone = "purple" | "orange" | "indigo" | "green" | "amber";

function Shell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mk-container", className)}>{children}</div>;
}

function Pill({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="mk-label inline-flex items-center gap-2 text-mk-accent">
      <span className="size-1.5 rounded-full bg-mk-accent" aria-hidden />
      {children}
    </p>
  );
}

function Heading({ id, badge, title, body, className }: { id: string; badge: string; tone?: Tone; title: string; body?: string; className?: string }) {
  return (
    <div className={cn("mx-auto max-w-3xl text-center", className)}>
      <Pill>{badge}</Pill>
      <h2 id={id} className="mk-display-lg mt-5 text-balance text-mk-text">
        <Highlighted text={title} />
      </h2>
      {body ? <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-mk-muted sm:text-lg">{body}</p> : null}
    </div>
  );
}

const isExternal = (href: string) => /^https:\/\//.test(href);

function TextLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  if (!href) return null;
  const cls = cn(
    "inline-flex items-center gap-1 rounded text-sm font-semibold text-mk-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent",
    className,
  );
  return isExternal(href) ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {children}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

const ctaAccent =
  "rounded-full bg-mk-accent font-bold text-mk-accent-ink shadow-[0_12px_40px_-12px_var(--accent-glow)] hover:bg-mk-accent-hover";
const ctaGhost =
  "inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/80 transition-colors hover:border-mk-accent hover:text-mk-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white";

// ---- Hero ------------------------------------------------------------------------------

/** Entrance: each block fades up once on first paint (CSS @starting-style, no JS). */
const enter = (delay = "", from = "starting:translate-y-4", duration = "duration-700") => cn("transition-[opacity,translate] ease-out starting:opacity-0", from, duration, delay);

export function LandingHero({ content, themes, tokens }: { content: LandingContent["hero"]; themes: MarketplaceTheme[]; tokens: Record<string, string | number> }) {
  const stats = content.stats.filter((s) => s.value && s.label);
  // Preload LCP image: prefer same-origin theme shot WebP, else ThemeMockup Unsplash (no CMS hero).
  const cmsHero = content.slides.some((s) => s.imageUrl) || Boolean(content.imageUrl);
  const firstTheme = themes[0];
  const localShot = firstTheme ? themeShot(firstTheme.key, "desktop") : null;
  const lcpPreload = cmsHero
    ? content.slides.find((s) => s.imageUrl)?.imageUrl || content.imageUrl || null
    : localShot || (firstTheme ? themeMockupHeroUrl(firstTheme, 640) : null);
  if (lcpPreload) preload(lcpPreload, { as: "image", fetchPriority: "high" });
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-mk-bg text-mk-text">
      <div aria-hidden className="mk-grid-texture absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_72%)]" />
      <div aria-hidden className="absolute top-1/4 right-[8%] -z-10 size-[min(42vw,28rem)] rounded-full bg-brand-orange/20 blur-3xl" />
      <div aria-hidden className="absolute top-1/4 right-[8%] -z-10 size-[min(42vw,28rem)] rounded-full bg-[radial-gradient(circle,var(--accent-glow),transparent_70%)] blur-2xl" />
      <div aria-hidden className="absolute -top-24 left-1/4 -z-10 size-72 rounded-full bg-mk-accent/10 blur-3xl motion-safe:animate-pulse [animation-duration:7s]" />
      <Shell className="grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10 lg:py-24">
        <div className="flex flex-col items-start">
          {content.badge ? (
            <p className={cn("mk-label inline-flex items-center gap-2 text-mk-accent", enter())}>
              <span className="size-1.5 rounded-full bg-mk-accent" aria-hidden />
              {content.badge}
            </p>
          ) : null}
          <h1 id="hero-title" className={cn("mk-display-xl mt-5 max-w-[14ch] text-balance", "transition-[translate] duration-700 ease-out starting:translate-y-3")}>
            <Highlighted text={content.titleLead} underline />
            {content.rotatingWords.length ? (
              <>
                {" "}
                <span className={cn("block min-h-[1.05em]", Math.max(...content.rotatingWords.map((w) => w.length)) <= 14 && "sm:min-h-[1.05em]")}>
                  <RotatingWords words={content.rotatingWords} />
                </span>
              </>
            ) : null}
          </h1>
          {content.body ? <p className={cn("mt-5 max-w-lg text-lg leading-relaxed text-mk-muted sm:text-xl", enter("delay-150"))}>{content.body}</p> : null}
          <div className={cn("mt-8 flex flex-wrap items-center gap-3 sm:gap-4", enter("delay-200"))}>
            {content.primaryCta.label ? (
              <ButtonLink href={content.primaryCta.href || "/start"} variant="cta" size="lg" className={ctaAccent} track={{ id: "create_store", location: "hero" }}>
                {content.primaryCta.label} <ArrowRight aria-hidden className="size-4" />
              </ButtonLink>
            ) : null}
            {content.secondaryCta.label && content.secondaryCta.href ? (
              <Link href={content.secondaryCta.href} className={ctaGhost}>
                {content.secondaryCta.label} <ChevronRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ) : null}
          </div>
          {stats.length || content.liveLabel ? (
            <div className={cn("mt-12 flex flex-wrap items-stretch gap-0", enter("delay-300"))}>
              {content.liveLabel ? (
                <p className="mk-label mr-5 mb-4 inline-flex items-center gap-1.5 self-center border border-mk-accent/35 bg-mk-accent-tint px-2.5 py-1 text-mk-accent">
                  <span className="relative grid size-1.5 place-items-center" aria-hidden>
                    <span className="absolute size-full rounded-full bg-mk-accent motion-safe:animate-ping" />
                    <span className="size-1.5 rounded-full bg-mk-accent" />
                  </span>
                  {content.liveLabel}
                </p>
              ) : null}
              {stats.length ? (
                <ul className="flex flex-wrap items-stretch">
                  {stats.map((s, i) => (
                    <li key={s.label} className={cn("flex min-w-[6.5rem] flex-col gap-1.5 px-5 sm:min-w-[7.5rem] sm:px-6", i > 0 && "border-l border-mk-line")}>
                      <span className="font-mk-display text-2xl font-bold tracking-tight text-mk-text tabular-nums sm:text-3xl">{fillTokens(s.value, tokens)}</span>
                      <span className="mk-label text-mk-dim">{s.label}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className={enter("delay-200", "starting:translate-x-8", "duration-1000")}>
          <HeroVisual content={content} themes={themes} />
        </div>
      </Shell>
    </section>
  );
}

function BrowserFrame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-mk-line bg-mk-elev-1 shadow-brand-float">
      <div className="flex items-center gap-1.5 border-b border-mk-line px-4 py-3" aria-hidden>
        <span className="size-2.5 rounded-full bg-white/25" />
        <span className="size-2.5 rounded-full bg-white/25" />
        <span className="size-2.5 rounded-full bg-mk-accent" />
        <span className="ml-3 h-4 flex-1 rounded-full bg-white/10" />
      </div>
      {children}
    </div>
  );
}

/**
 * Right-hand visual, first match wins: CMS slides (a slideshow in a browser frame), the single
 * hero image, then the showcase themes' previews (a slideshow when there are several).
 */
function HeroVisual({ content, themes }: { content: LandingContent["hero"]; themes: MarketplaceTheme[] }) {
  const slides = content.slides.filter((s) => s.imageUrl);
  const glow = (
    <>
      <div aria-hidden className="absolute -inset-10 -z-10 rounded-[40px] bg-brand-orange/25 blur-3xl" />
      <div aria-hidden className="absolute -inset-8 -z-10 rounded-[40px] bg-[radial-gradient(circle_at_50%_40%,var(--accent-glow),transparent_65%)] blur-2xl" />
      <div aria-hidden className="absolute inset-x-8 top-8 bottom-16 -z-10 rotate-2 rounded-2xl border border-mk-line bg-mk-elev-2/60" />
    </>
  );
  if (slides.length || content.imageUrl) {
    const list = slides.length ? slides : [{ imageUrl: content.imageUrl, alt: content.imageAlt, caption: "" }];
    return (
      <figure className="relative">
        {glow}
        <HeroSlideshow
          label="Store previews"
          interval={content.slideInterval}
          autoplay={content.autoplay}
          captions={list.map((s) => s.caption)}
          slides={[
            ...list.map((s, i) => (
              <BrowserFrame key={i}>
                <img src={s.imageUrl} alt={s.alt} className="block aspect-[16/10] w-full object-cover object-top" loading={i === 0 ? "eager" : "lazy"} fetchPriority={i === 0 ? "high" : "auto"} decoding="async" />
              </BrowserFrame>
            )),
          ]}
        />
      </figure>
    );
  }
  if (!themes.length) return null;
  return (
    <figure className="relative w-full pb-1">
      {glow}
      <HeroSlideshow
        label="Theme previews"
        interval={content.slideInterval}
        autoplay={content.autoplay}
        captions={themes.map((t) => `${t.name} theme, with sample products`)}
        slides={themes.map((t, i) => (
          <div key={t.key} className="relative rounded-2xl bg-mk-elev-1 p-1.5 ring-1 ring-mk-line sm:p-2">
            <ThemeDevicePreview theme={t} size="large" eager={i === 0} />
          </div>
        ))}
      />
    </figure>
  );
}

// ---- Trust strip -------------------------------------------------------------------------

/** Scroll-reveal for grid children (see Reveal): the li fades up, the card inside owns hover. */
const revealItem = "transition-[opacity,translate] duration-700 ease-out group-data-[reveal=hidden]/reveal:translate-y-6 group-data-[reveal=hidden]/reveal:opacity-0";
const revealDelay = (i: number) => ({ transitionDelay: `${Math.min(i, 11) * 55}ms` });

function MarqueeRow({ chips, reverse }: { chips: LandingContent["trust"]["chips"]; reverse?: boolean }) {
  return (
    <div className="group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] motion-reduce:[mask-image:none]">
      <ul
        className={cn(
          "flex w-max gap-3 px-1.5 py-1 group-hover:[animation-play-state:paused] motion-reduce:mx-auto motion-reduce:w-auto motion-reduce:max-w-5xl motion-reduce:flex-wrap motion-reduce:justify-center",
          reverse ? "motion-safe:animate-[marquee-reverse_55s_linear_infinite]" : "motion-safe:animate-[marquee_50s_linear_infinite]",
        )}
      >
        {[...chips, ...chips].map((c, i) => (
          <li
            key={`${c.label}-${reverse ? "b" : "a"}-${i}`}
            aria-hidden={i >= chips.length}
            className={cn(
              "inline-flex items-center gap-2.5 rounded-full border border-mk-line bg-mk-elev-1 py-1.5 pr-4 pl-1.5 text-sm font-medium whitespace-nowrap text-mk-text/90 transition-colors hover:border-mk-line-strong hover:bg-mk-elev-2",
              i >= chips.length && "motion-reduce:hidden",
            )}
          >
            <span className={cn("grid size-7 place-items-center rounded-full", ACCENT[c.color].chip)}>
              <LandingIconView name={c.icon} className="size-3.5" />
            </span>
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TrustStrip({ content }: { content: LandingContent["trust"] }) {
  const chips = content.chips.filter((c) => c.label);
  if (!chips.length) return null;
  const mid = Math.ceil(chips.length / 2);
  const rowA = chips.slice(0, mid);
  const rowB = chips.slice(mid);
  return (
    <section aria-label={content.title || "Business categories"} className="border-y border-mk-line bg-mk-elev-1/40 py-10">
      {content.title ? <p className="mk-label text-center text-mk-dim">{content.title}</p> : null}
      <div className="mt-6 space-y-3">
        <MarqueeRow chips={rowA.length ? rowA : chips} />
        {rowB.length ? <MarqueeRow chips={rowB} reverse /> : null}
      </div>
    </section>
  );
}

// ---- What / where to sell ----------------------------------------------------------------

export function Solutions({ content }: { content: LandingContent["solutions"] }) {
  return (
    <section id="solutions" aria-labelledby="solutions-title" className="mk-section relative isolate scroll-mt-20 overflow-hidden bg-mk-bg">
      <div aria-hidden className="absolute top-24 -left-32 -z-10 size-96 rounded-full bg-mk-accent/10 blur-3xl" />
      <Shell>
        <Heading id="solutions-title" badge={content.badge} tone="orange" title={content.title} body={content.body} />
        <Reveal as="ul" className="mt-14 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {content.items.map((item, i) => {
            const tint = ACCENT[item.color === "auto" ? tagColor(item.tag, i) : item.color];
            return (
              <li key={item.title} className={revealItem} style={revealDelay(i)}>
                <div className="group relative h-full rounded-[var(--r-md)] border border-mk-line bg-mk-elev-1 p-4 transition-[translate,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-mk-line-strong hover:shadow-brand-card motion-reduce:hover:translate-y-0 sm:p-5">
                  <div className="relative flex flex-col items-start gap-3 sm:flex-row">
                    <span className="grid size-11 shrink-0 place-items-center rounded-[var(--r-sm)] bg-mk-elev-2 text-mk-accent transition-transform duration-300 group-hover:scale-105 motion-reduce:group-hover:transform-none">
                      <LandingIconView name={item.icon} className="size-5" />
                    </span>
                    <div>
                      <h3 className="mk-h3 text-mk-text">{item.title}</h3>
                      {item.tag ? <p className={cn("mk-label mt-1", tint.text)}>{item.tag}</p> : null}
                    </div>
                  </div>
                  <p className="relative mt-3 flex-1 text-xs leading-relaxed text-mk-muted sm:mt-4 sm:text-sm">{item.body}</p>
                  {item.linkLabel && item.href ? (
                    <TextLink href={item.href} className="relative mt-4 text-xs after:absolute after:-inset-[200px] after:content-['']">
                      {item.linkLabel} <ArrowRight aria-hidden className="size-3.5 transition-transform group-hover:translate-x-1" />
                      <span className="sr-only">: {item.title}</span>
                    </TextLink>
                  ) : null}
                  {item.badge ? (
                    <span className="absolute -top-2.5 right-4 rounded-full bg-mk-accent px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-mk-accent-ink uppercase shadow-[0_6px_14px_-6px_var(--accent-glow)]">
                      {item.badge}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </Reveal>
      </Shell>
    </section>
  );
}

// ---- Steps -------------------------------------------------------------------------------

export function Steps({ content }: { content: LandingContent["steps"] }) {
  const total = content.items.length;
  return (
    <section id="steps" aria-labelledby="steps-title" className="mk-section scroll-mt-20 bg-mk-elev-1/30">
      <Shell>
        <Heading id="steps-title" badge={content.badge} tone="orange" title={content.title} body={content.body} />
        <StepsStack className="mx-auto mt-14 max-w-5xl">
          {content.items.map((step, i) => (
            <StepsStackCard key={`${step.title}-${i}`} index={i} total={total}>
              <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-10">
                <div className="max-w-md">
                  <p className="font-mk-mono text-3xl font-medium tracking-tight text-mk-accent/90 tabular-nums sm:text-4xl">
                    {String(i + 1).padStart(2, "0")}
                    <span className="ml-2 text-base font-normal text-mk-dim">/ {String(total).padStart(2, "0")}</span>
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-[var(--r-sm)] bg-mk-elev-2 text-mk-accent">
                      <LandingIconView name={step.icon} className="size-5" />
                    </span>
                    <span className="mk-label text-mk-dim">Step {String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="mk-h3 mt-5 text-mk-text">{step.title}</h3>
                  <p className="mt-3 text-base leading-relaxed text-mk-muted">{step.body}</p>
                </div>
                <StepCard
                  visual={step.visual}
                  imageUrl={step.imageUrl}
                  imageAlt={step.imageAlt}
                  mediaKind={inferStepMediaKind(step.imageUrl, step.mediaKind)}
                  posterUrl={step.posterUrl ?? ""}
                  index={i}
                />
              </div>
            </StepsStackCard>
          ))}
        </StepsStack>
        {content.cta.label ? (
          <div className="mt-16 flex flex-col items-center gap-3 text-center">
            <ButtonLink href={content.cta.href || "/start"} variant="orange" size="lg" className={ctaAccent} track={{ id: "create_store", location: "steps" }}>
              {content.cta.label} <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
            {content.note ? <p className="text-xs text-mk-dim">{content.note}</p> : null}
            {content.link.label && content.link.href ? (
              <TextLink href={content.link.href} className="text-xs">
                {content.link.label} <ChevronRight aria-hidden className="size-3.5" />
              </TextLink>
            ) : null}
          </div>
        ) : null}
      </Shell>
    </section>
  );
}

const STEP_BG = [
  "bg-[linear-gradient(135deg,#fff4eb,#ffffff)]",
  "bg-[linear-gradient(135deg,#fff7ed,#ffffff)]",
  "bg-[linear-gradient(135deg,#ffe4d6,#fff1e6)]",
  "bg-[linear-gradient(135deg,#ffedd5,#fff4eb,#f7f7f5)]",
  "bg-[linear-gradient(160deg,#fff4eb,#fed7aa,#f3f3f2)]",
];

function StepCard({
  visual,
  imageUrl,
  imageAlt,
  mediaKind,
  posterUrl,
  index,
}: {
  visual: StepVisual;
  imageUrl: string;
  imageAlt: string;
  mediaKind: StepMediaKind;
  posterUrl: string;
  index: number;
}) {
  if (imageUrl) {
    return (
      <div className="overflow-hidden rounded-[var(--r-md)] border border-mk-line bg-mk-elev-2 shadow-brand-card">
        {mediaKind === "video" ? (
          <video
            src={imageUrl}
            poster={posterUrl || undefined}
            autoPlay
            muted
            loop
            playsInline
            className="block aspect-[4/3] w-full object-cover"
            aria-label={imageAlt || undefined}
          />
        ) : (
          <img src={imageUrl} alt={imageAlt} loading="lazy" className="block aspect-[4/3] w-full object-cover" />
        )}
      </div>
    );
  }
  if (visual === "none") return <div className="hidden lg:block" aria-hidden />;
  return (
    <div
      aria-hidden
      className={cn(
        "mk-light relative grid aspect-[4/3] place-items-center overflow-hidden rounded-[var(--r-md)] border border-mk-line p-8 shadow-brand-card",
        STEP_BG[index % STEP_BG.length],
      )}
    >
      <StepIllustration visual={visual} />
    </div>
  );
}

/** Lightweight HTML/CSS illustrations of each onboarding screen (no images to load). */
function StepIllustration({ visual }: { visual: StepVisual }) {
  switch (visual) {
    case "signup":
      return (
        <div className="w-full max-w-[260px] -rotate-3 rounded-2xl bg-surface p-6 shadow-2xl">
          <p className="text-center font-brand text-lg font-extrabold text-brand-ink">Sign up</p>
          <div className="mt-4 h-9 rounded-lg bg-brand-canvas px-3 text-[11px] leading-9 text-subtle">you@business.in</div>
          <div className="mt-3 flex h-9 items-center justify-center gap-2 rounded-lg bg-brand-orange text-xs font-bold text-white">
            <span className="grid size-4 place-items-center rounded-full bg-surface text-[9px] font-black text-brand-orange">G</span> Continue with Google
          </div>
          <div className="mt-3 h-9 rounded-lg bg-brand-ink text-center text-xs leading-9 font-bold text-white">Create account</div>
          <p className="mt-3 text-center text-[10px] text-subtle">No credit card required</p>
        </div>
      );
    case "details":
      return (
        <div className="w-full max-w-[300px] rounded-2xl bg-surface p-6 shadow-2xl">
          <p className="text-center font-brand text-lg font-extrabold text-brand-ink">Tell us about your store.</p>
          <div className="mt-4 rounded-lg border border-border px-3 py-2 text-[11px] text-brand-ink">Store name · Asha&apos;s Bakes</div>
          <div className="mt-2 rounded-lg border border-border px-3 py-2 text-[11px] text-subtle">
            ashasbakes.<span className="font-semibold text-brand">pictocart.in</span>
          </div>
          <div className="mx-auto mt-4 h-9 w-32 rounded-full bg-brand-orange text-center text-xs leading-9 font-bold text-white">Continue →</div>
        </div>
      );
    case "category":
      return (
        <div className="relative">
          <span className="absolute top-10 -left-16 size-28 rounded-full bg-gradient-to-br from-[#fdba74] to-brand-orange opacity-90 blur-[1px]" />
          <div className="relative w-[150px] rounded-[26px] border-[5px] border-brand-ink bg-surface p-2.5 shadow-2xl">
            <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-brand-ink" />
            <p className="text-[9px] text-subtle">Choose a category</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {["Fashion", "Bakery", "Beauty", "Décor", "Gifts", "Tech"].map((c, i) => (
                <span key={c} className={cn("rounded-md px-1.5 py-2 text-center text-[9px] font-semibold", i === 1 ? "bg-brand-orange text-white" : "bg-brand-canvas text-brand-ink")}>
                  {c}
                </span>
              ))}
            </div>
            <div className="mt-2 h-6 rounded-md bg-brand-ink text-center text-[9px] leading-6 font-bold text-white">Next</div>
          </div>
        </div>
      );
    case "theme":
      return (
        <div className="w-full max-w-[340px] rounded-xl bg-[#1e293b] p-3 shadow-2xl">
          <div className="flex items-center justify-between text-[10px] font-semibold text-white/80">
            <span>Themes</span>
            <span className="rounded bg-brand-orange px-2 py-0.5 text-white">Apply theme</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {["from-[#f97316] to-[#111111]", "from-[#fed7aa] to-[#ea580c]", "from-[#fdba74] to-[#9a3412]", "from-[#fde68a] to-[#f97316]", "from-[#ffedd5] to-[#c2410c]", "from-[#f3f3f2] to-[#111111]"].map((g, i) => (
              <div key={g} className={cn("rounded-md bg-surface p-1", i === 0 && "ring-2 ring-brand-orange")}>
                <div className={cn("h-12 rounded bg-gradient-to-br", g)} />
                <div className="mt-1 h-1.5 w-3/4 rounded bg-black/10" />
              </div>
            ))}
          </div>
        </div>
      );
    case "live":
      return (
        <div className="relative text-center">
          {["-top-10 -left-20", "-top-6 -right-20", "-bottom-10 -left-24", "-bottom-12 -right-16"].map((pos, i) => (
            <span key={pos} className={cn("absolute size-4 rotate-12 rounded-sm", pos, ["bg-brand-orange", "bg-brand-ink", "bg-brand-orange-hover", "bg-[#fdba74]"][i])} />
          ))}
          <p className="font-brand text-[11px] font-semibold tracking-widest text-white/90 uppercase drop-shadow">Your store is</p>
          <p className="font-brand text-6xl font-black tracking-tight text-white drop-shadow-[0_6px_20px_rgb(0_0_0/0.15)]">LIVE</p>
          <p className="mx-auto mt-3 w-fit rounded-md bg-surface px-3 py-1.5 font-mono text-[11px] text-brand-ink shadow">myshop.pictocart.in</p>
          <p className="mx-auto mt-3 w-fit rounded-full bg-brand-orange px-5 py-2 text-xs font-bold text-white shadow-lg">Share on WhatsApp</p>
        </div>
      );
    default:
      return null;
  }
}

// ---- FAQ ---------------------------------------------------------------------------------

export function LandingFaq({ content }: { content: LandingContent["faq"] }) {
  if (!content.items.length) return null;
  return (
    <section id="faq" aria-labelledby="faq-title" className="mk-section scroll-mt-20 bg-mk-bg">
      <Shell>
        <Heading id="faq-title" badge={content.badge} tone="orange" title={content.title} body={content.body} />
        <div className="mx-auto mt-10 max-w-3xl divide-y divide-mk-line border-y border-mk-line">
          {content.items.map((f) => (
            <details key={f.question} className="group [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded py-5 text-[0.95rem] font-semibold text-mk-text focus-visible:outline-2 focus-visible:outline-mk-accent">
                {f.question}
                <span
                  aria-hidden
                  className="relative grid size-6 shrink-0 place-items-center text-mk-accent"
                >
                  <span className="absolute h-px w-3.5 bg-current transition-transform duration-300 group-open:rotate-45 motion-reduce:transition-none" />
                  <span className="absolute h-3.5 w-px bg-current transition-transform duration-300 group-open:rotate-45 motion-reduce:transition-none" />
                </span>
              </summary>
              <p className="pb-5 text-sm leading-relaxed whitespace-pre-line text-mk-muted">{f.answer}</p>
            </details>
          ))}
        </div>
        {content.link.label && content.link.href ? (
          <p className="mt-6 text-center">
            <TextLink href={content.link.href} className="text-xs">
              {content.link.label} <ChevronRight aria-hidden className="size-3.5" />
            </TextLink>
          </p>
        ) : null}
      </Shell>
    </section>
  );
}

// ---- Features ----------------------------------------------------------------------------

export function Features({ content }: { content: LandingContent["features"] }) {
  const [first, second, ...rest] = content.items;
  const side = [first, second].filter((x): x is NonNullable<typeof x> => Boolean(x));
  return (
    <section id="features" aria-labelledby="features-title" className="mk-section scroll-mt-20 bg-mk-elev-1/20">
      <Shell>
        <Heading id="features-title" badge={content.badge} tone="orange" title={content.title} body={content.body} />
        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          <div className="relative overflow-hidden rounded-[var(--r-lg)] border border-mk-line bg-mk-elev-1 p-8 shadow-brand-card sm:p-10 lg:col-span-2">
            <span aria-hidden className="absolute -top-20 -right-16 size-56 rounded-full bg-mk-accent/15 blur-3xl" />
            <span aria-hidden className="mk-grid-texture absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]" />
            <span className="relative grid size-12 place-items-center rounded-[var(--r-sm)] bg-mk-elev-2 text-mk-accent">
              <LandingIconView name={content.highlight.icon} className="size-6" />
            </span>
            <h3 className="mk-h3 relative mt-6 text-mk-text">{content.highlight.title}</h3>
            <p className="relative mt-3 max-w-lg leading-relaxed text-mk-muted">{content.highlight.body}</p>
            {content.highlight.tags.length ? (
              <ul className="relative mt-6 flex flex-wrap gap-2">
                {content.highlight.tags.map((t) => (
                  <li key={t} className="rounded-full border border-mk-line bg-mk-elev-2 px-3 py-1 text-xs font-medium text-mk-muted">
                    {t}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {side.length ? (
            <ul className="grid gap-4">
              {side.map((f) => (
                <FeatureCard key={f.title} {...f} />
              ))}
            </ul>
          ) : null}
        </div>
        {rest.length ? (
          <ul className="mt-4 grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
            {rest.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </ul>
        ) : null}
        {content.mini.length ? (
          <ul className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
            {content.mini.map((m) => (
              <li key={m.title} className="flex flex-col items-center gap-2 rounded-[var(--r-md)] border border-mk-line bg-mk-elev-1 px-4 py-5 text-center transition-colors hover:border-mk-line-strong">
                <LandingIconView name={m.icon} className="size-5 text-mk-accent" />
                <span className="text-sm font-semibold text-mk-text">{m.title}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Shell>
    </section>
  );
}

function FeatureCard({ icon, title, body }: LandingContent["features"]["items"][number]) {
  return (
    <li className="rounded-[var(--r-md)] border border-mk-line bg-mk-elev-1 p-6 transition-colors hover:border-mk-line-strong">
      <span className="grid size-10 place-items-center rounded-[var(--r-sm)] bg-mk-elev-2 text-mk-accent">
        <LandingIconView name={icon} className="size-5" />
      </span>
      <h3 className="mt-4 font-brand font-bold text-mk-text">{title}</h3>
      <p className="mt-1 text-sm text-mk-muted">{body}</p>
    </li>
  );
}

// ---- Themes ------------------------------------------------------------------------------

export function LandingThemes({ content, themes, images }: { content: LandingContent["themes"]; themes: MarketplaceTheme[]; images?: Map<string, CategoryImage> }) {
  if (!themes.length) return null;
  return (
    <section id="themes" aria-labelledby="themes-title" className="mk-section scroll-mt-20 bg-mk-bg">
      <Shell>
        <Heading id="themes-title" badge={content.badge} tone="orange" title={content.title} body={content.body} />
        <ul className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 [content-visibility:auto] [contain-intrinsic-size:auto_420px]">
          {themes.map((t, i) => (
            <li key={t.key} className="h-full">
              {/* First row can paint with the page; deeper cards wait until near viewport. */}
              {i < 4 ? (
                <ThemeCard theme={t} image={images?.get(t.key) ?? null} location="home_themes" />
              ) : (
                <WhenVisible
                  placeholder={
                    <div
                      className="aspect-[4/3] w-full animate-pulse rounded-[var(--r-md)] border border-mk-line bg-mk-elev-1"
                      style={{ background: t.preset.tokens.colors.background }}
                      aria-hidden
                    />
                  }
                >
                  <ThemeCard theme={t} image={images?.get(t.key) ?? null} location="home_themes" />
                </WhenVisible>
              )}
            </li>
          ))}
        </ul>
        {content.button.label ? (
          <div className="mt-12 text-center">
            <ButtonLink
              href={content.button.href || "/themes"}
              variant="primary"
              className="rounded-full border border-mk-line-strong bg-mk-elev-1 text-mk-text hover:border-mk-accent hover:text-mk-accent"
              track={{ id: "all_themes", location: "home_themes" }}
            >
              {content.button.label} <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
          </div>
        ) : null}
      </Shell>
    </section>
  );
}

// ---- Categories --------------------------------------------------------------------------

export function LandingCategories({ content }: { content: LandingContent["categories"] }) {
  const items = content.items.filter((c) => c.label);
  return (
    <section id="categories" aria-labelledby="categories-title" className="mk-section relative isolate scroll-mt-20 overflow-hidden bg-mk-elev-1/25">
      <div aria-hidden className="absolute -top-20 left-1/4 -z-10 size-80 rounded-full bg-mk-accent/10 blur-3xl" />
      <Shell>
        <Heading id="categories-title" badge="" tone="orange" title={content.title} body={content.body} />
        <Reveal as="ul" className="mx-auto mt-12 flex max-w-5xl flex-wrap justify-center gap-3">
          {items.map((c, i) => (
            <li key={`${c.label}-${i}`} className={revealItem} style={revealDelay(i)}>
              <CategoryTile item={c} />
            </li>
          ))}
        </Reveal>
      </Shell>
    </section>
  );
}

function CategoryTile({ item }: { item: LandingContent["categories"]["items"][number] }) {
  const tint = ACCENT[item.color];
  const body = (
    <>
      {item.imageUrl ? (
        <span className="relative block size-10 overflow-hidden rounded-full sm:size-11">
          <img src={item.imageUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:group-hover:scale-100" />
        </span>
      ) : (
        <span className={cn("grid size-9 place-items-center rounded-full bg-gradient-to-br text-white sm:size-10", tint.solid)}>
          <LandingIconView name={item.icon} className="size-4" />
        </span>
      )}
      <span className="text-sm font-semibold text-mk-text">{item.label}</span>
    </>
  );
  const cls =
    "group inline-flex items-center gap-2.5 rounded-full border border-mk-line bg-mk-elev-1 py-2 pr-4 pl-2 transition-[border-color,background-color,translate] duration-300 hover:-translate-y-0.5 hover:border-mk-accent/50 hover:bg-mk-elev-2 motion-reduce:hover:translate-y-0";
  if (!item.href) {
    return <div className={cls}>{body}</div>;
  }
  const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent";
  return isExternal(item.href) ? (
    <a href={item.href} target="_blank" rel="noopener noreferrer" className={cn(cls, focus)}>
      {body}
    </a>
  ) : (
    <Link href={item.href} className={cn(cls, focus)}>
      {body}
    </Link>
  );
}

// ---- Pricing -----------------------------------------------------------------------------

export function LandingPricing({ content, plans }: { content: LandingContent["pricing"]; plans: MarketingPlan[] }) {
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="mk-section scroll-mt-20 bg-mk-bg">
      <Shell>
        <Heading id="pricing-title" badge={content.badge} tone="orange" title={content.title} body={content.body} />
        <div className="mx-auto mt-14 max-w-5xl">
          <PricingTable plans={plans} />
        </div>
        {content.note || content.noteLink.label ? (
          <p className="mt-10 text-center text-sm text-mk-muted">
            {content.note}{" "}
            {content.noteLink.label && content.noteLink.href ? <TextLink href={content.noteLink.href}>{content.noteLink.label}</TextLink> : null}
          </p>
        ) : null}
      </Shell>
    </section>
  );
}

// ---- Testimonials ------------------------------------------------------------------------

export function Testimonials({ content }: { content: LandingContent["testimonials"] }) {
  if (!content.items.length) return null;
  return (
    <section id="testimonials" aria-labelledby="testimonials-title" className="mk-section scroll-mt-20 bg-mk-elev-1/20">
      <Shell>
        <Heading id="testimonials-title" badge={content.badge} tone="amber" title={content.title} />
        <ul className={cn("mx-auto mt-12 grid gap-6", content.items.length === 1 ? "max-w-2xl" : content.items.length === 2 ? "max-w-5xl md:grid-cols-2" : "lg:grid-cols-3")}>
          {content.items.map((t) => (
            <li key={t.name + t.quote.slice(0, 20)} className="relative flex flex-col rounded-[var(--r-md)] border border-mk-line bg-mk-elev-1 p-7 sm:p-8">
              <Quote aria-hidden className="absolute top-6 right-6 size-8 text-mk-accent/25" />
              <p className="flex gap-0.5" aria-label={`${t.rating} out of 5 stars`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} aria-hidden className={cn("size-4", i < t.rating ? "fill-mk-accent text-mk-accent" : "text-mk-line-strong")} />
                ))}
              </p>
              <blockquote className="mt-5 flex-1 font-mk-display text-lg leading-snug tracking-tight text-mk-text sm:text-xl">&ldquo;{t.quote}&rdquo;</blockquote>
              <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-semibold text-mk-text">{t.name}</p>
                  {t.business ? <p className="mt-0.5 text-sm text-mk-dim">{t.business}</p> : null}
                </div>
                {t.result ? <span className="rounded-full bg-mk-accent-tint px-3 py-1 text-xs font-semibold text-mk-accent">{t.result}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      </Shell>
    </section>
  );
}

// ---- Final CTA ---------------------------------------------------------------------------

export function LandingCta({ content }: { content: LandingContent["cta"] }) {
  return (
    <section aria-labelledby="final-cta-title" className="relative isolate overflow-hidden bg-mk-bg py-20 text-center text-mk-text sm:py-28">
      <div aria-hidden className="mk-grid-texture absolute inset-0 -z-10 opacity-70" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(45%_55%_at_50%_0%,var(--accent-glow),transparent_70%)] opacity-60" />
      <Shell>
        <h2 id="final-cta-title" className="mk-display-lg mx-auto max-w-3xl text-balance">
          <Highlighted text={content.title} underline />
        </h2>
        {content.body ? <p className="mx-auto mt-4 max-w-xl text-lg text-mk-muted">{content.body}</p> : null}
        {content.button.label ? (
          <div className="mt-8 flex justify-center">
            <ButtonLink href={content.button.href || "/start"} variant="cta" size="lg" className={ctaAccent} track={{ id: "create_store", location: "final_cta" }}>
              {content.button.label} <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
          </div>
        ) : null}
        {content.note ? (
          <p className="mt-5 inline-flex items-center gap-1.5 text-xs text-mk-dim">
            <Check aria-hidden className="size-3.5 text-mk-accent" /> {content.note}
          </p>
        ) : null}
      </Shell>
    </section>
  );
}
