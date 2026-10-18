import type { Metadata } from "next";
import { getRenderContext } from "@/features/theme/render/load";
import { getFaqs } from "@/features/storefront/server/content";
import { jsonLdString } from "@/features/storefront/seo";
import { BUILTIN_TITLE_DEFAULTS } from "@/features/theme/schema/site";

export async function generateMetadata({ params }: PageProps<"/store/[host]/faq">): Promise<Metadata> {
  const { host } = await params;
  const { sf } = await getRenderContext(host);
  return { title: sf.theme.builtinTitles.faq || "FAQs" };
}

export default async function FaqPage({ params }: PageProps<"/store/[host]/faq">) {
  const { host } = await params;
  const { sf } = await getRenderContext(host);
  const faqs = await getFaqs(sf.tenant.tenantId, { limit: 100 });
  const groups = [...new Set(faqs.map((f) => f.group))];
  const ld = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) };
  return (
    <div className="sf-container sf-section mx-auto max-w-3xl">
      {faqs.length ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(ld) }} /> : null}
      <h1 className="sf-heading mb-8 text-4xl">{sf.theme.builtinTitles.faq || BUILTIN_TITLE_DEFAULTS.faq}</h1>
      {faqs.length === 0 ? <p className="sf-muted">No FAQs yet.</p> : null}
      {groups.map((g) => (
        <section key={g} className="mb-8">
          {groups.length > 1 ? <h2 className="sf-heading mb-3 text-2xl">{g}</h2> : null}
          <div className="sf-border divide-y divide-[var(--sf-border)] border-y">
            {faqs
              .filter((f) => f.group === g)
              .map((f) => (
                <details key={f.id} className="group py-4">
                  <summary className="flex cursor-pointer list-none justify-between gap-4 font-medium">
                    {f.question}
                    <span aria-hidden className="transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="sf-muted mt-3 whitespace-pre-line text-sm">{f.answer}</p>
                </details>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
