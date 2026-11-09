/* eslint-disable @next/next/no-img-element -- CMS infographic URLs */
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import type { FeaturePage } from "../feature-pages";
import { FEATURE_GROUP_LABELS } from "../feature-pages";
import { ButtonLink, Container } from "./ui";

export function FeaturePageView({ page }: { page: FeaturePage }) {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-mk-bg text-mk-text">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(50%_60%_at_20%_0%,var(--accent-glow),transparent_70%),radial-gradient(40%_50%_at_90%_80%,rgb(234_88_12/0.1),transparent_70%)]"
        />
        <Container className="py-16 sm:py-20">
          <p className="mk-label inline-flex items-center gap-2 text-mk-accent">
            <span className="size-1.5 rounded-full bg-mk-accent" aria-hidden />
            {page.eyebrow || FEATURE_GROUP_LABELS[page.group]}
          </p>
          <h1 className="mk-display-lg mt-4 max-w-3xl text-balance text-mk-text">{page.title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-mk-muted">{page.summary}</p>
          <div className="mt-8">
            <ButtonLink
              href={page.ctaHref || "/start"}
              variant="cta"
              size="lg"
              className="rounded-full bg-mk-accent font-bold text-mk-accent-ink shadow-[0_12px_40px_-12px_var(--accent-glow)] hover:bg-mk-accent-hover"
              track={{ id: "create_store", location: `feature_${page.slug}` }}
            >
              {page.ctaLabel || "Start free"} <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
          </div>
        </Container>
      </section>

      <section className="border-t border-mk-line bg-mk-elev-1 py-16 sm:py-20">
        <Container className="grid items-start gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <h2 className="font-brand text-2xl font-extrabold tracking-tight text-mk-text">Why it matters</h2>
            <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-mk-muted">{page.body}</p>
            {page.bullets.length ? (
              <ul className="mt-8 space-y-3">
                {page.bullets.map((b) => (
                  <li key={b} className="flex gap-3 text-sm text-mk-text">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-mk-accent-tint text-mk-accent">
                      <Check aria-hidden className="size-3.5 stroke-[2.5]" />
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-10 text-sm text-mk-muted">
              <Link href="/features" className="font-semibold text-mk-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent">
                ← All features
              </Link>
            </p>
          </div>
          <figure className="overflow-hidden rounded-mk-lg border border-mk-line bg-mk-elev-2 shadow-brand-card">
            {page.infographicUrl ? (
              page.infographicUrl.toLowerCase().includes(".mp4") ? (
                <video src={page.infographicUrl} muted loop playsInline autoPlay className="aspect-[4/3] w-full object-cover" aria-label={page.infographicAlt || page.title} />
              ) : (
                <img src={page.infographicUrl} alt={page.infographicAlt || page.title} className="aspect-[4/3] w-full object-cover" />
              )
            ) : (
              <div className="grid aspect-[4/3] place-items-center bg-gradient-to-br from-mk-elev-2 via-mk-bg to-mk-accent-tint p-10 text-center">
                <div>
                  <p className="font-brand text-xl font-extrabold text-mk-text">{page.title}</p>
                  <p className="mt-2 text-sm text-mk-muted">Infographic slot — upload from Admin → Landing → Feature pages</p>
                </div>
              </div>
            )}
            {page.infographicAlt ? <figcaption className="border-t border-mk-line px-4 py-3 text-xs text-mk-muted">{page.infographicAlt}</figcaption> : null}
          </figure>
        </Container>
      </section>

      <section className="border-t border-mk-line bg-mk-bg py-14 text-center">
        <Container>
          <h2 className="font-brand text-2xl font-extrabold text-mk-text sm:text-3xl">Ready to try it on your store?</h2>
          <p className="mx-auto mt-3 max-w-lg text-mk-muted">Create a free Pictocart store and turn this capability on from your dashboard.</p>
          <div className="mt-7 flex justify-center">
            <ButtonLink
              href={page.ctaHref || "/start"}
              variant="cta"
              size="lg"
              className="rounded-full bg-mk-accent font-bold text-mk-accent-ink shadow-[0_12px_40px_-12px_var(--accent-glow)] hover:bg-mk-accent-hover"
              track={{ id: "create_store", location: `feature_footer_${page.slug}` }}
            >
              {page.ctaLabel || "Start free"} <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
