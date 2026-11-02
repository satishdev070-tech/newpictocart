/* eslint-disable @next/next/no-img-element -- CMS infographic URLs */
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import type { FeaturePage } from "../feature-pages";
import { FEATURE_GROUP_LABELS } from "../feature-pages";
import { ButtonLink, Container } from "./ui";

export function FeaturePageView({ page }: { page: FeaturePage }) {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-brand-night text-white">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(50%_60%_at_20%_0%,rgb(234_88_12/0.28),transparent_70%),radial-gradient(40%_50%_at_90%_80%,rgb(21_128_61/0.18),transparent_70%)]" />
        <Container className="py-16 sm:py-20">
          <p className="text-xs font-bold tracking-[0.14em] text-brand-orange uppercase">{page.eyebrow || FEATURE_GROUP_LABELS[page.group]}</p>
          <h1 className="mt-4 max-w-3xl font-brand text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">{page.title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/75">{page.summary}</p>
          <div className="mt-8">
            <ButtonLink href={page.ctaHref || "/start"} variant="cta" size="lg" className="rounded-xl" track={{ id: "create_store", location: `feature_${page.slug}` }}>
              {page.ctaLabel || "Start free"} <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
          </div>
        </Container>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <Container className="grid items-start gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <h2 className="font-brand text-2xl font-extrabold tracking-tight text-brand-ink">Why it matters</h2>
            <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-muted">{page.body}</p>
            {page.bullets.length ? (
              <ul className="mt-8 space-y-3">
                {page.bullets.map((b) => (
                  <li key={b} className="flex gap-3 text-sm text-brand-ink">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-mint text-brand-success">
                      <Check aria-hidden className="size-3.5 stroke-[2.5]" />
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-10 text-sm text-muted">
              <Link href="/features" className="font-semibold text-brand-orange hover:underline">
                ← All features
              </Link>
            </p>
          </div>
          <figure className="overflow-hidden rounded-3xl border border-border bg-brand-canvas shadow-brand-card">
            {page.infographicUrl ? (
              page.infographicUrl.toLowerCase().includes(".mp4") ? (
                <video src={page.infographicUrl} muted loop playsInline autoPlay className="aspect-[4/3] w-full object-cover" aria-label={page.infographicAlt || page.title} />
              ) : (
                <img src={page.infographicUrl} alt={page.infographicAlt || page.title} className="aspect-[4/3] w-full object-cover" />
              )
            ) : (
              <div className="grid aspect-[4/3] place-items-center bg-gradient-to-br from-brand-accent-soft via-white to-brand-mint p-10 text-center">
                <div>
                  <p className="font-brand text-xl font-extrabold text-brand-ink">{page.title}</p>
                  <p className="mt-2 text-sm text-muted">Infographic slot — upload from Admin → Landing → Feature pages</p>
                </div>
              </div>
            )}
            {page.infographicAlt ? <figcaption className="border-t border-border px-4 py-3 text-xs text-muted">{page.infographicAlt}</figcaption> : null}
          </figure>
        </Container>
      </section>

      <section className="border-t border-border bg-brand-canvas py-14 text-center">
        <Container>
          <h2 className="font-brand text-2xl font-extrabold text-brand-ink sm:text-3xl">Ready to try it on your store?</h2>
          <p className="mx-auto mt-3 max-w-lg text-muted">Create a free Pictocart store and turn this capability on from your dashboard.</p>
          <div className="mt-7 flex justify-center">
            <ButtonLink href={page.ctaHref || "/start"} variant="orange" size="lg" className="rounded-xl" track={{ id: "create_store", location: `feature_footer_${page.slug}` }}>
              {page.ctaLabel || "Start free"} <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
