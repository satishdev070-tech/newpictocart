import type { Metadata } from "next";
import { CalendarClock, Headphones, ShieldCheck } from "lucide-react";
import { buildMarketingMetadata } from "@/features/marketing-site/seo";
import { siteOrigin } from "@/features/marketing-site/site";
import { Container } from "@/features/marketing-site/components/ui";
import { listOpenSlots } from "@/features/team-calls/server";
import { BookCallForm } from "@/features/team-calls/components/book-call-form";

// Slots change as people book; render on each request (no account needed).
export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return buildMarketingMetadata({
    title: "Book a free call with our team",
    description: "Talk to a Pictocart expert before you sign up: pick a time and we'll call you to plan your online store, payments and first orders. Free, no obligation.",
    path: "/book-call",
    origin: siteOrigin(),
  });
}

const POINTS = [
  { icon: Headphones, title: "A real person", body: "Someone from our team in India calls you at the time you pick." },
  { icon: CalendarClock, title: "Your time", body: "Choose any free slot in the next few weeks. Times are in IST." },
  { icon: ShieldCheck, title: "No obligation", body: "Free, and you don't need an account. We only call about your booking." },
];

/** Public "Book a free call" (marketing host). Rate-limited server action + honeypot. */
export default async function BookCallPublicPage() {
  const { available, slots } = await listOpenSlots().catch(() => ({ available: false, slots: [] }));
  return (
    <section className="bg-gradient-to-b from-mk-bg to-mk-elev-1 pt-14 pb-20 sm:pt-20">
      <Container className="max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mk-label inline-flex items-center justify-center gap-2 text-mk-accent">
            <span className="size-1.5 rounded-full bg-mk-accent" aria-hidden />
            Free call
          </p>
          <h1 className="mk-display-lg mt-4 text-balance text-mk-text">Book a free call with our team</h1>
          <p className="mt-4 text-lg leading-relaxed text-mk-muted">Not sure where to start? Pick a time and we&apos;ll walk you through setting up your store, payments and first orders.</p>
        </div>
        <ul className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
          {POINTS.map((p) => (
            <li key={p.title} className="rounded-2xl border border-mk-line bg-mk-elev-1 p-4 text-left">
              <p.icon aria-hidden className="size-5 text-mk-accent" />
              <p className="mt-2 font-semibold text-mk-text">{p.title}</p>
              <p className="mt-1 text-sm text-mk-muted">{p.body}</p>
            </li>
          ))}
        </ul>
        <div className="theme-panel mx-auto mt-10 max-w-3xl rounded-2xl border border-border bg-surface p-4 text-foreground shadow-xl sm:p-6">
          {available ? <BookCallForm mode="public" slots={slots} /> : <p className="py-6 text-center text-small text-muted">Booking opens soon. Please check back later.</p>}
        </div>
      </Container>
    </section>
  );
}
