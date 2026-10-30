import Link from "next/link";
import dynamic from "next/dynamic";
import { preload } from "react-dom";
import { ArrowRight, Check, ChevronDown, ChevronRight, Quote, Star } from "lucide-react";
import type { ReactNode } from "react";
import type { MarketplaceTheme } from "@/features/theme/marketplace/types";
import type { CategoryImage } from "@/lib/unsplash";
import { cn } from "@/lib/cn";
import type { MarketingPlan } from "../plans";
import { fillTokens, type LandingContent, type StepVisual } from "../landing";
import { ButtonLink, Container } from "./ui";
import { ACCENT, Highlighted, LandingIconView, tagColor } from "./landing-icons";
import { RotatingWords } from "./rotating-words";
import { HeroSlideshow } from "./hero-slideshow";
import { Reveal } from "./reveal";
import { themeMockupHeroUrl } from "@/features/theme/marketplace/mockup";
import { ThemeCard, ThemeDevicePreview } from "./theme-card";
import { WhenVisible } from "./when-visible";

/** Below-fold pricing island — keep the client PricingTable out of the initial home JS. */
const PricingTable = dynamic(() => import("./pricing-table").then((m) => ({ default: m.PricingTable })));

/* eslint-disable @next/next/no-img-element -- CMS images are admin-provided URLs, shown as-is */

type Tone = "purple" | "orange" | "indigo" | "green" | "amber";
const PILL: Record<Tone, string> = {
  purple: "bg-[#f3eefe] text-brand-purple",
  orange: "bg-brand-accent-soft text-brand-orange-hover",
  indigo: "bg-brand-soft text-brand",
  green: "bg-brand-mint text-brand-cta-hover",
  amber: "bg-[#fef3c7] text-[#92400e]",
};

function Pill({ children, tone }: { children: ReactNode; tone: Tone }) {
  if (!children) return null;
  return <p className={cn("inline-flex rounded-full px-3.5 py-1 text-xs font-semibold", PILL[tone])}>{children}</p>;
}

function Heading({ id, badge, tone, title, body, className }: { id: string; badge: string; tone: Tone; title: string; body?: string; className?: string }) {
  return (
    <div className={cn("mx-auto max-w-3xl text-center", className)}>
      <Pill tone={tone}>{badge}</Pill>
      <h2 id={id} className="mt-4 font-brand text-3xl font-extrabold tracking-tight text-balance text-brand-ink sm:text-[2.75rem] sm:leading-[1.1]">
        <Highlighted text={title} />
      </h2>
      {body ? <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">{body}</p> : null}
    </div>
  );
}

const isExternal = (href: string) => /^https:\/\//.test(href);

function TextLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  if (!href) return null;
  const cls = cn("inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand rounded", className);
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

// ---- Hero ------------------------------------------------------------------------------

/** Entrance: each block fades up once on first paint (CSS @starting-style, no JS). */
const enter = (delay = "", from = "starting:translate-y-4", duration = "duration-700") => cn("transition-[opacity,translate] ease-out starting:opacity-0", from, duration, delay);

export function LandingHero({ content, themes, tokens }: { content: LandingContent["hero"]; themes: MarketplaceTheme[]; tokens: Record<string, string | number> }) {
  const stats = content.stats.filter((s) => s.value && s.label);
  // Preload LCP image when hero falls back to ThemeMockup (no CMS slides/image).
  const cmsHero = content.slides.some((s) => s.imageUrl) || Boolean(content.imageUrl);
  const lcpPreload = !cmsHero && themes[0] ? themeMockupHeroUrl(themes[0], 640) : cmsHero ? content.slides.find((s) => s.imageUrl)?.imageUrl || content.imageUrl || null : null;
  if (lcpPreload) preload(lcpPreload, { as: "image", fetchPriority: "high" });
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-brand-night text-white">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_15%_10%,rgb(79_70_229/0.45),transparent_70%),radial-gradient(50%_60%_at_85%_80%,rgb(124_58_237/0.4),transparent_70%),radial-gradient(40%_40%_at_70%_20%,rgb(5_150_105/0.18),transparent_70%)]" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      <div aria-hidden className="absolute -top-24 left-1/3 -z-10 size-72 rounded-full bg-[#7c3aed]/25 blur-3xl motion-safe:animate-pulse [animation-duration:6s]" />
      <Container className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[0.88fr_1.22fr] lg:gap-8 lg:py-24">
        <div>
          {content.badge ? (
            <p className={cn("inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/85 backdrop-blur", enter())}>
              <LandingIconView name="zap" className="size-3.5 text-[#34d399]" />
              {content.badge}
            </p>
          ) : null}
          <h1 id="hero-title" className={cn("mt-6 font-brand text-[2.6rem] font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-[3.8rem]", "transition-[translate] duration-700 ease-out starting:translate-y-3")}>
            <Highlighted text={content.titleLead} onDark />
            {content.rotatingWords.length ? (
              <>
                {" "}
                <span className={cn("block min-h-[2.1em]", Math.max(...content.rotatingWords.map((w) => w.length)) <= 14 && "sm:min-h-[1.05em]")}>
                  <RotatingWords words={content.rotatingWords} />
                </span>
              </>
            ) : null}
          </h1>
          {content.body ? <p className={cn("mt-6 max-w-xl text-lg leading-relaxed text-white/75", enter("delay-150"))}>{content.body}</p> : null}
          <div className={cn("mt-8 flex flex-wrap items-center gap-x-6 gap-y-4", enter("delay-200"))}>
            {content.primaryCta.label ? (
              <ButtonLink href={content.primaryCta.href || "/start"} variant="cta" size="lg" className="rounded-xl shadow-[0_12px_30px_-10px_rgb(16_185_129/0.7)]" track={{ id: "create_store", location: "hero" }}>
                {content.primaryCta.label} <ArrowRight aria-hidden className="size-4" />
              </ButtonLink>
            ) : null}
            {content.secondaryCta.label && content.secondaryCta.href ? (
              <Link href={content.secondaryCta.href} className="group inline-flex items-center gap-1 rounded text-sm font-medium text-white/80 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                {content.secondaryCta.label} <ChevronRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ) : null}
          </div>
          {stats.length ? (
            <ul className={cn("mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/70", enter("delay-300"))}>
              {content.liveLabel ? (
                <li className="inline-flex items-center gap-1.5 rounded-full border border-[#34d399]/40 bg-[#34d399]/10 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-[#34d399]">
                  <span className="relative grid size-1.5 place-items-center" aria-hidden>
                    <span className="absolute size-full rounded-full bg-[#34d399] motion-safe:animate-ping" />
                    <span className="size-1.5 rounded-full bg-[#34d399]" />
                  </span>
                  {content.liveLabel}
                </li>
              ) : null}
              {stats.map((s) => (
                <li key={s.label} className="inline-flex items-center gap-2">
                  <LandingIconView name={s.icon} className="size-4 text-[#a5b4fc]" />
                  <span>
                    <strong className="font-bold text-white">{fillTokens(s.value, tokens)}</strong> {s.label}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className={enter("delay-200", "starting:translate-x-8", "duration-1000")}>
          <HeroVisual content={content} themes={themes} />
        </div>
      </Container>
    </section>
  );
}

function BrowserFrame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#141235] shadow-[0_40px_80px_-30px_rgb(0_0_0/0.8)]">
      <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3" aria-hidden>
        <span className="size-2.5 rounded-full bg-[#f87171]" />
        <span className="size-2.5 rounded-full bg-[#fbbf24]" />
        <span className="size-2.5 rounded-full bg-[#34d399]" />
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
      <div aria-hidden className="absolute -inset-6 -z-10 rounded-[40px] bg-brand/30 blur-3xl" />
      <div aria-hidden className="absolute inset-x-6 top-6 bottom-20 -z-10 rotate-2 rounded-2xl bg-gradient-to-br from-[#7c3aed]/40 to-[#4f46e5]/20 ring-1 ring-white/10" />
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
          <div key={t.key} className="relative rounded-2xl bg-white/[0.03] p-1.5 ring-1 ring-white/10 sm:p-2">
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

export function TrustStrip({ content }: { content: LandingContent["trust"] }) {
  const chips = content.chips.filter((c) => c.label);
  if (!chips.length) return null;
  return (
    <section aria-label={content.title || "Business categories"} className="border-b border-border bg-white py-10">
      {content.title ? <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-subtle">{content.title}</p> : null}
      <div className="group relative mt-6 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] motion-reduce:[mask-image:none]">
        <ul className="flex w-max gap-3 px-1.5 py-1 motion-safe:animate-[marquee_50s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:mx-auto motion-reduce:w-auto motion-reduce:max-w-5xl motion-reduce:flex-wrap motion-reduce:justify-center">
          {[...chips, ...chips].map((c, i) => (
            <li
              key={`${c.label}-${i}`}
              aria-hidden={i >= chips.length}
              className={cn("inline-flex items-center gap-2.5 rounded-full border border-border bg-white py-1.5 pr-4 pl-1.5 text-sm font-medium whitespace-nowrap text-brand-ink/85 shadow-[0_1px_2px_rgb(15_23_42/0.05)] transition-colors hover:border-border-strong", i >= chips.length && "motion-reduce:hidden")}
            >
              <span className={cn("grid size-7 place-items-center rounded-full", ACCENT[c.color].chip)}>
                <LandingIconView name={c.icon} className="size-3.5" />
              </span>
              {c.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---- What / where to sell ----------------------------------------------------------------

export function Solutions({ content }: { content: LandingContent["solutions"] }) {
  return (
    <section id="solutions" aria-labelledby="solutions-title" className="relative isolate scroll-mt-20 overflow-hidden bg-gradient-to-b from-white to-brand-canvas/60 py-20 sm:py-24">
      <div aria-hidden className="absolute top-24 -left-32 -z-10 size-96 rounded-full bg-[#a78bfa]/15 blur-3xl" />
      <div aria-hidden className="absolute -right-32 bottom-10 -z-10 size-96 rounded-full bg-[#34d399]/10 blur-3xl" />
      <Container>
        <Heading id="solutions-title" badge={content.badge} tone="purple" title={content.title} body={content.body} />
        <Reveal as="ul" className="mt-14 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {content.items.map((item, i) => {
            const tint = ACCENT[item.color === "auto" ? tagColor(item.tag, i) : item.color];
            return (
              <li key={item.title} className={revealItem} style={revealDelay(i)}>
                <div className="group relative h-full rounded-2xl bg-border p-px transition-[translate,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_-24px_rgb(27_29_69/0.35)] motion-reduce:hover:translate-y-0">
                  <span aria-hidden className={cn("absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100", tint.ring)} />
                  <div className="relative flex h-full flex-col overflow-hidden rounded-[15px] bg-white p-4 sm:p-5">
                    <span aria-hidden className={cn("absolute -top-10 -right-10 size-28 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100", tint.glow)} />
                    <div className="relative flex flex-col items-start gap-3 sm:flex-row">
                      <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 motion-reduce:group-hover:transform-none", tint.chip)}>
                        <LandingIconView name={item.icon} className="size-5" />
                      </span>
                      <div>
                        <h3 className="font-brand text-[0.95rem] leading-snug font-bold text-brand-ink">{item.title}</h3>
                        {item.tag ? <p className={cn("mt-0.5 text-[10px] font-bold tracking-[0.14em] uppercase", tint.text)}>{item.tag}</p> : null}
                      </div>
                    </div>
                    <p className="relative mt-3 flex-1 text-xs leading-relaxed text-muted sm:mt-4 sm:text-sm">{item.body}</p>
                    {item.linkLabel && item.href ? (
                      <TextLink href={item.href} className="relative mt-4 text-xs after:absolute after:-inset-[200px] after:content-['']">
                        {item.linkLabel} <ArrowRight aria-hidden className="size-3.5 transition-transform group-hover:translate-x-1" />
                        <span className="sr-only">: {item.title}</span>
                      </TextLink>
                    ) : null}
                  </div>
                  {item.badge ? <span className="absolute -top-2.5 right-4 rounded-full bg-gradient-to-r from-brand-accent to-[#f43f5e] px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase shadow-[0_6px_14px_-6px_rgb(234_88_12/0.8)]">{item.badge}</span> : null}
                </div>
              </li>
            );
          })}
        </Reveal>
      </Container>
    </section>
  );
}

// ---- Steps -------------------------------------------------------------------------------

const STEP_TINT = ["bg-brand-mint text-brand-cta-hover", "bg-brand-accent-soft text-brand-orange-hover", "bg-[#fde8ec] text-[#be123c]", "bg-[#f3eefe] text-brand-purple", "bg-[#fdeefe] text-[#a21caf]"];
const STEP_BG = [
  "bg-[linear-gradient(135deg,#fde2d6,#f6d5f0)]",
  "bg-[linear-gradient(135deg,#fff7ed,#ffffff)]",
  "bg-[linear-gradient(135deg,#ffe4d6,#fff1e6)]",
  "bg-[linear-gradient(135deg,#fbcfe8,#c7d2fe,#a5f3fc)]",
  "bg-[linear-gradient(160deg,#fbcfe8,#fed7aa,#bae6fd)]",
];

export function Steps({ content }: { content: LandingContent["steps"] }) {
  return (
    <section id="steps" aria-labelledby="steps-title" className="scroll-mt-20 bg-white py-20 sm:py-24">
      <Container>
        <Heading id="steps-title" badge={content.badge} tone="orange" title={content.title} body={content.body} />
        <ol className="relative mt-16 space-y-16 lg:space-y-24">
          <span aria-hidden className="absolute top-0 bottom-0 left-1/2 hidden w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-border to-transparent lg:block" />
          {content.items.map((step, i) => {
            const flip = i % 2 === 1;
            return (
              <li key={step.title} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
                <div className={cn("max-w-md", flip && "lg:order-2 lg:ml-auto lg:text-right")}>
                  <div className={cn("flex items-center gap-3", flip && "lg:flex-row-reverse")}>
                    <span className={cn("grid size-10 place-items-center rounded-xl", STEP_TINT[i % STEP_TINT.length])}>
                      <LandingIconView name={step.icon} className="size-5" />
                    </span>
                    <span className="font-mono text-xs font-semibold tracking-[0.16em] text-subtle">STEP {String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="mt-4 font-brand text-2xl font-extrabold tracking-tight text-brand-ink sm:text-3xl">{step.title}</h3>
                  <p className="mt-3 text-base leading-relaxed text-muted">{step.body}</p>
                </div>
                <div className={cn(flip && "lg:order-1")}>
                  <StepCard visual={step.visual} imageUrl={step.imageUrl} imageAlt={step.imageAlt} index={i} />
                </div>
              </li>
            );
          })}
        </ol>
        {content.cta.label ? (
          <div className="mt-20 flex flex-col items-center gap-3 text-center">
            <ButtonLink href={content.cta.href || "/start"} variant="orange" size="lg" className="rounded-xl" track={{ id: "create_store", location: "steps" }}>
              {content.cta.label} <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
            {content.note ? <p className="text-xs text-subtle">{content.note}</p> : null}
            {content.link.label && content.link.href ? (
              <TextLink href={content.link.href} className="text-xs">
                {content.link.label} <ChevronRight aria-hidden className="size-3.5" />
              </TextLink>
            ) : null}
          </div>
        ) : null}
      </Container>
    </section>
  );
}

function StepCard({ visual, imageUrl, imageAlt, index }: { visual: StepVisual; imageUrl: string; imageAlt: string; index: number }) {
  if (imageUrl) {
    return (
      <div className="overflow-hidden rounded-3xl shadow-[0_30px_60px_-30px_rgb(27_29_69/0.35)] ring-1 ring-border">
        <img src={imageUrl} alt={imageAlt} loading="lazy" className="block aspect-[4/3] w-full object-cover" />
      </div>
    );
  }
  if (visual === "none") return null;
  return (
    <div aria-hidden className={cn("relative grid aspect-[4/3] place-items-center overflow-hidden rounded-3xl p-8 shadow-[0_30px_60px_-30px_rgb(27_29_69/0.35)] ring-1 ring-black/5", STEP_BG[index % STEP_BG.length])}>
      <StepIllustration visual={visual} />
    </div>
  );
}

/** Lightweight HTML/CSS illustrations of each onboarding screen (no images to load). */
function StepIllustration({ visual }: { visual: StepVisual }) {
  switch (visual) {
    case "signup":
      return (
        <div className="w-full max-w-[260px] -rotate-3 rounded-2xl bg-white p-6 shadow-2xl">
          <p className="text-center font-brand text-lg font-extrabold text-brand-ink">Sign up</p>
          <div className="mt-4 h-9 rounded-lg bg-brand-canvas px-3 text-[11px] leading-9 text-subtle">you@business.in</div>
          <div className="mt-3 flex h-9 items-center justify-center gap-2 rounded-lg bg-brand-orange text-xs font-bold text-white">
            <span className="grid size-4 place-items-center rounded-full bg-white text-[9px] font-black text-brand-orange">G</span> Continue with Google
          </div>
          <div className="mt-3 h-9 rounded-lg bg-brand-ink text-center text-xs leading-9 font-bold text-white">Create account</div>
          <p className="mt-3 text-center text-[10px] text-subtle">No credit card required</p>
        </div>
      );
    case "details":
      return (
        <div className="w-full max-w-[300px] rounded-2xl bg-white p-6 shadow-2xl">
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
          <div className="relative w-[150px] rounded-[26px] border-[5px] border-brand-ink bg-white p-2.5 shadow-2xl">
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
            <span className="rounded bg-brand-cta px-2 py-0.5 text-white">Apply theme</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {["from-[#f97316] to-[#7c3aed]", "from-[#fbcfe8] to-[#f472b6]", "from-[#a5f3fc] to-[#4f46e5]", "from-[#fde68a] to-[#f97316]", "from-[#bbf7d0] to-[#059669]", "from-[#e9d5ff] to-[#7c3aed]"].map((g, i) => (
              <div key={g} className={cn("rounded-md bg-white p-1", i === 0 && "ring-2 ring-brand-cta")}>
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
            <span key={pos} className={cn("absolute size-4 rotate-12 rounded-sm", pos, ["bg-brand-orange", "bg-brand-purple", "bg-brand-cta", "bg-[#f472b6]"][i])} />
          ))}
          <p className="font-brand text-[11px] font-semibold tracking-widest text-white/90 uppercase drop-shadow">Your store is</p>
          <p className="font-brand text-6xl font-black tracking-tight text-white drop-shadow-[0_6px_20px_rgb(0_0_0/0.15)]">LIVE</p>
          <p className="mx-auto mt-3 w-fit rounded-md bg-white px-3 py-1.5 font-mono text-[11px] text-brand-ink shadow">myshop.pictocart.in</p>
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
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 bg-white pb-20 sm:pb-24">
      <Container>
        <Heading id="faq-title" badge={content.badge} tone="indigo" title={content.title} body={content.body} />
        <div className="mx-auto mt-10 max-w-3xl divide-y divide-border rounded-2xl border border-border bg-white shadow-brand-card">
          {content.items.map((f) => (
            <details key={f.question} className="group px-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded py-4 text-[0.95rem] font-semibold text-brand-ink focus-visible:outline-2 focus-visible:outline-brand">
                {f.question}
                <ChevronDown aria-hidden className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none" />
              </summary>
              <p className="pb-5 text-sm leading-relaxed whitespace-pre-line text-muted">{f.answer}</p>
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
      </Container>
    </section>
  );
}

// ---- Features ----------------------------------------------------------------------------

export function Features({ content }: { content: LandingContent["features"] }) {
  const [first, second, ...rest] = content.items;
  const side = [first, second].filter((x): x is NonNullable<typeof x> => Boolean(x));
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-20 bg-brand-canvas py-20 sm:py-24">
      <Container>
        <Heading id="features-title" badge={content.badge} tone="purple" title={content.title} body={content.body} />
        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#4f46e5,#7c3aed)] p-8 text-white shadow-[0_30px_60px_-30px_rgb(79_70_229/0.7)] sm:p-10 lg:col-span-2">
            <span aria-hidden className="absolute -top-16 -right-16 size-56 rounded-full bg-white/10" />
            <span aria-hidden className="absolute -bottom-24 left-1/3 size-56 rounded-full bg-white/5" />
            <span className="relative grid size-12 place-items-center rounded-xl bg-white/15">
              <LandingIconView name={content.highlight.icon} className="size-6" />
            </span>
            <h3 className="relative mt-6 font-brand text-2xl font-extrabold sm:text-3xl">{content.highlight.title}</h3>
            <p className="relative mt-3 max-w-lg leading-relaxed text-white/80">{content.highlight.body}</p>
            {content.highlight.tags.length ? (
              <ul className="relative mt-6 flex flex-wrap gap-2">
                {content.highlight.tags.map((t) => (
                  <li key={t} className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                    {t}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {side.length ? (
            <ul className="grid gap-5">
              {side.map((f) => (
                <FeatureCard key={f.title} {...f} />
              ))}
            </ul>
          ) : null}
        </div>
        {rest.length ? (
          <ul className="mt-5 grid gap-5 sm:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
            {rest.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </ul>
        ) : null}
        {content.mini.length ? (
          <ul className="mt-5 grid grid-cols-2 gap-5 md:grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
            {content.mini.map((m) => (
              <li key={m.title} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-white px-4 py-5 text-center">
                <LandingIconView name={m.icon} className="size-5 text-brand" />
                <span className="text-sm font-semibold text-brand-ink">{m.title}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Container>
    </section>
  );
}

function FeatureCard({ icon, title, body }: LandingContent["features"]["items"][number]) {
  return (
    <li className="rounded-2xl border border-border bg-white p-6">
      <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
        <LandingIconView name={icon} className="size-5" />
      </span>
      <h3 className="mt-4 font-brand font-bold text-brand-ink">{title}</h3>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </li>
  );
}

// ---- Themes ------------------------------------------------------------------------------

export function LandingThemes({ content, themes, images }: { content: LandingContent["themes"]; themes: MarketplaceTheme[]; images?: Map<string, CategoryImage> }) {
  if (!themes.length) return null;
  return (
    <section id="themes" aria-labelledby="themes-title" className="scroll-mt-20 bg-white py-20 sm:py-24">
      <Container>
        <Heading id="themes-title" badge={content.badge} tone="green" title={content.title} body={content.body} />
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
                      className="aspect-[4/3] w-full animate-pulse rounded-brand-md border border-border bg-brand-canvas"
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
            <ButtonLink href={content.button.href || "/themes"} variant="indigo" track={{ id: "all_themes", location: "home_themes" }}>
              {content.button.label} <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
          </div>
        ) : null}
      </Container>
    </section>
  );
}

// ---- Categories --------------------------------------------------------------------------

export function LandingCategories({ content }: { content: LandingContent["categories"] }) {
  const items = content.items.filter((c) => c.label);
  return (
    <section id="categories" aria-labelledby="categories-title" className="relative isolate scroll-mt-20 overflow-hidden bg-brand-canvas py-20 sm:py-24">
      <div aria-hidden className="absolute -top-20 left-1/4 -z-10 size-80 rounded-full bg-[#f472b6]/12 blur-3xl" />
      <div aria-hidden className="absolute right-1/4 -bottom-24 -z-10 size-80 rounded-full bg-[#60a5fa]/15 blur-3xl" />
      <Container>
        <Heading id="categories-title" badge="" tone="indigo" title={content.title} body={content.body} />
        <Reveal as="ul" className="mx-auto mt-12 grid max-w-6xl grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5">
          {items.map((c, i) => (
            <li key={`${c.label}-${i}`} className={revealItem} style={revealDelay(i)}>
              <CategoryTile item={c} />
            </li>
          ))}
        </Reveal>
      </Container>
    </section>
  );
}

function CategoryTile({ item }: { item: LandingContent["categories"]["items"][number] }) {
  const tint = ACCENT[item.color];
  const body = (
    <>
      {item.imageUrl ? (
        <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-xl">
          <img src={item.imageUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:group-hover:scale-100" />
          <span className={cn("absolute bottom-2 left-2 grid size-8 place-items-center rounded-lg bg-gradient-to-br text-white shadow-lg", tint.solid)}>
            <LandingIconView name={item.icon} className="size-4" />
          </span>
        </span>
      ) : (
        <span className="relative grid size-14 place-items-center sm:size-16">
          <span aria-hidden className={cn("absolute inset-0 rounded-2xl bg-gradient-to-br opacity-90 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 motion-reduce:group-hover:transform-none", tint.solid)} />
          <span aria-hidden className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_30%_25%,rgb(255_255_255/0.45),transparent_60%)]" />
          <LandingIconView name={item.icon} className="relative size-6 text-white drop-shadow-sm transition-transform duration-300 group-hover:-translate-y-0.5 sm:size-7" />
        </span>
      )}
      <span className="mt-3 text-center text-xs leading-snug font-semibold text-brand-ink sm:text-sm">{item.label}</span>
    </>
  );
  const cls = cn(
    "group relative flex h-full flex-col items-center overflow-hidden rounded-2xl border border-border bg-white p-3 transition-[translate,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-[0_20px_40px_-20px_rgb(27_29_69/0.35)] motion-reduce:hover:translate-y-0 sm:p-4",
    !item.imageUrl && "justify-center py-5 sm:py-6",
  );
  const glow = <span aria-hidden className={cn("pointer-events-none absolute -bottom-12 left-1/2 size-24 -translate-x-1/2 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100", tint.glow)} />;
  if (!item.href) {
    return (
      <div className={cls}>
        {glow}
        {body}
      </div>
    );
  }
  const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
  return isExternal(item.href) ? (
    <a href={item.href} target="_blank" rel="noopener noreferrer" className={cn(cls, focus)}>
      {glow}
      {body}
    </a>
  ) : (
    <Link href={item.href} className={cn(cls, focus)}>
      {glow}
      {body}
    </Link>
  );
}

// ---- Pricing -----------------------------------------------------------------------------

export function LandingPricing({ content, plans }: { content: LandingContent["pricing"]; plans: MarketingPlan[] }) {
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-20 bg-white py-20 sm:py-24">
      <Container>
        <Heading id="pricing-title" badge={content.badge} tone="indigo" title={content.title} body={content.body} />
        <div className="mx-auto mt-14 max-w-5xl">
          <PricingTable plans={plans} />
        </div>
        {content.note || content.noteLink.label ? (
          <p className="mt-10 text-center text-sm text-muted">
            {content.note}{" "}
            {content.noteLink.label && content.noteLink.href ? <TextLink href={content.noteLink.href}>{content.noteLink.label}</TextLink> : null}
          </p>
        ) : null}
      </Container>
    </section>
  );
}

// ---- Testimonials ------------------------------------------------------------------------

export function Testimonials({ content }: { content: LandingContent["testimonials"] }) {
  if (!content.items.length) return null;
  return (
    <section id="testimonials" aria-labelledby="testimonials-title" className="scroll-mt-20 bg-brand-canvas py-20 sm:py-24">
      <Container>
        <Heading id="testimonials-title" badge={content.badge} tone="amber" title={content.title} />
        <ul className={cn("mx-auto mt-12 grid gap-6", content.items.length === 1 ? "max-w-2xl" : content.items.length === 2 ? "max-w-5xl md:grid-cols-2" : "lg:grid-cols-3")}>
          {content.items.map((t) => (
            <li key={t.name + t.quote.slice(0, 20)} className="relative flex flex-col rounded-2xl border border-border bg-white p-7 shadow-brand-card">
              <Quote aria-hidden className="absolute top-6 right-6 size-8 text-brand-soft" />
              <p className="flex gap-0.5" aria-label={`${t.rating} out of 5 stars`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} aria-hidden className={cn("size-4", i < t.rating ? "fill-[#fbbf24] text-[#fbbf24]" : "text-border-strong")} />
                ))}
              </p>
              <blockquote className="mt-4 flex-1 text-[1.05rem] leading-relaxed text-brand-ink">&ldquo;{t.quote}&rdquo;</blockquote>
              <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-semibold text-brand-ink">{t.name}</p>
                  {t.business ? <p className="text-sm text-muted">{t.business}</p> : null}
                </div>
                {t.result ? <span className="rounded-full bg-brand-mint px-3 py-1 text-xs font-semibold text-brand-cta-hover">{t.result}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

// ---- Final CTA ---------------------------------------------------------------------------

export function LandingCta({ content }: { content: LandingContent["cta"] }) {
  return (
    <section aria-labelledby="final-cta-title" className="relative isolate overflow-hidden bg-[linear-gradient(120deg,#4f46e5,#7c3aed_60%,#6d28d9)] py-20 text-center text-white sm:py-24">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(40%_60%_at_20%_0%,rgb(255_255_255/0.15),transparent_70%),radial-gradient(40%_60%_at_90%_100%,rgb(5_150_105/0.25),transparent_70%)]" />
      <Container>
        <h2 id="final-cta-title" className="mx-auto max-w-3xl font-brand text-3xl font-extrabold tracking-tight text-balance sm:text-5xl">
          <Highlighted text={content.title} onDark />
        </h2>
        {content.body ? <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">{content.body}</p> : null}
        {content.button.label ? (
          <div className="mt-8 flex justify-center">
            <ButtonLink href={content.button.href || "/start"} variant="cta" size="lg" className="rounded-xl" track={{ id: "create_store", location: "final_cta" }}>
              {content.button.label} <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
          </div>
        ) : null}
        {content.note ? (
          <p className="mt-5 inline-flex items-center gap-1.5 text-xs text-white/70">
            <Check aria-hidden className="size-3.5" /> {content.note}
          </p>
        ) : null}
      </Container>
    </section>
  );
}

