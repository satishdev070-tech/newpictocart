import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buildMarketingMetadata } from "@/features/marketing-site/seo";
import { siteOrigin } from "@/features/marketing-site/site";
import { entryPlan, isFreeForeverPlan, signupTrialDays } from "@/features/marketing-site/plans";
import { getMarketingPlans } from "@/features/marketing-site/server/plans";
import { CTA_CREATE, SIGNUP_HREF } from "@/features/marketing-site/content";
import { ButtonLink, Container } from "@/features/marketing-site/components/ui";
import { FinalCta } from "@/features/marketing-site/components/home-sections";
import { FEATURE_GROUP_LABELS, FEATURE_GROUPS, featurePagesByGroup } from "@/features/marketing-site/feature-pages";
import { getFeaturePages } from "@/features/marketing-site/server/feature-pages";

export const revalidate = 300;

export function generateMetadata(): Metadata {
  return buildMarketingMetadata({
    title: "Features",
    description: "Explore every Pictocart capability — sell, source, design, channels, operate and grow — with dedicated guides for each feature.",
    path: "/features",
    origin: siteOrigin(),
  });
}

export default async function FeaturesPage() {
  const [plans, doc] = await Promise.all([getMarketingPlans(), getFeaturePages()]);
  const byGroup = featurePagesByGroup(doc);
  const trialDays = signupTrialDays(plans);
  const freeForever = Boolean(entryPlan(plans) && isFreeForeverPlan(entryPlan(plans)!));
  return (
    <>
      <section className="bg-gradient-to-b from-mk-bg to-mk-elev-1 pt-16 sm:pt-20">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <p className="mk-label inline-flex items-center justify-center gap-2 text-mk-accent">
              <span className="size-1.5 rounded-full bg-mk-accent" aria-hidden />
              Features
            </p>
            <h1 className="mk-display-lg mt-4 text-balance text-mk-text">Everything you need to run your online store</h1>
            <p className="mt-4 text-lg leading-relaxed text-mk-muted">
              Deep-dive pages for every capability in the Features menu — from Snap-to-Product AI to Pica2.
            </p>
          </div>
          <div className="mt-8 flex justify-center">
            <ButtonLink href={SIGNUP_HREF} size="lg" variant="cta" className="rounded-full bg-mk-accent font-bold text-mk-accent-ink shadow-[0_12px_40px_-12px_var(--accent-glow)] hover:bg-mk-accent-hover" track={{ id: "create_store", location: "features_page" }}>
              {CTA_CREATE}
            </ButtonLink>
          </div>
        </Container>
      </section>

      {FEATURE_GROUPS.map((group) => {
        const pages = byGroup[group];
        if (!pages.length) return null;
        return (
          <section key={group} className="border-t border-mk-line bg-mk-bg py-14 sm:py-16" aria-labelledby={`group-${group}`}>
            <Container>
              <h2 id={`group-${group}`} className="font-brand text-2xl font-extrabold tracking-tight text-mk-text">
                {FEATURE_GROUP_LABELS[group]}
              </h2>
              <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pages.map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={group === "design" && p.slug === "theme-marketplace" ? "/themes" : `/features/${p.slug}`}
                      className="group flex h-full flex-col rounded-mk-md border border-mk-line bg-mk-elev-1 p-5 transition-colors hover:border-mk-accent/40 hover:bg-mk-elev-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent"
                    >
                      <p className="mk-label text-mk-accent">{p.eyebrow || FEATURE_GROUP_LABELS[p.group]}</p>
                      <h3 className="mt-2 font-brand text-lg font-bold text-mk-text group-hover:text-mk-accent">{p.title}</h3>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-mk-muted">{p.summary}</p>
                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-mk-text">
                        Learn more <ArrowRight aria-hidden className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Container>
          </section>
        );
      })}

      <FinalCta trialDays={trialDays} freeForever={freeForever} />
    </>
  );
}
