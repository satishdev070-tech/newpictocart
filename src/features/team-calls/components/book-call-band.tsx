import Link from "next/link";
import { Headphones } from "lucide-react";
import { Container } from "@/features/marketing-site/components/ui";

/** Landing page band → /book-call (visitors can talk to the team before signing up). */
export function BookCallBand() {
  return (
    <section aria-labelledby="book-call-band" className="bg-mk-bg py-12 sm:py-16">
      <Container className="max-w-5xl">
        <div className="flex flex-col items-start gap-5 rounded-3xl border border-mk-line bg-mk-elev-1 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex items-start gap-4">
            <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-mk-accent/15 text-mk-accent">
              <Headphones className="size-6" />
            </span>
            <div>
              <h2 id="book-call-band" className="mk-h3 text-mk-text">
                Talk to our team first
              </h2>
              <p className="mt-1 max-w-xl text-mk-muted">Book a free call. Pick a time and an expert will help you plan your store, payments and first orders.</p>
            </div>
          </div>
          <Link
            href="/book-call"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-mk-accent px-6 font-bold text-mk-accent-ink hover:bg-mk-accent-hover sm:w-auto"
          >
            Book a free call
          </Link>
        </div>
      </Container>
    </section>
  );
}
