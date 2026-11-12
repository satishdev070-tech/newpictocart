import type { Metadata } from "next";
import { Badge, Card, PageHeader } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { FaqForm } from "@/features/informative/panel/content-forms";
import { RowControls } from "@/features/informative/panel/ui";
import { requireInformativeTenant } from "@/features/informative/server/context";
import { listFaqs } from "@/features/informative/server/repo";

export const metadata: Metadata = { title: "FAQs" };

export default async function InformativeFaqsPage() {
  const ctx = await requireInformativeTenant();
  const faqs = await listFaqs(ctx);
  const canWrite = ctx.permissions.has("content.write");
  return (
    <>
      <PageHeader title="FAQs" description="Answer the questions people ask before they book." />
      {canWrite ? (
        <Card title="Add a question" className="mb-6">
          <details>
            <summary className="cursor-pointer text-small font-medium text-accent">Add question</summary>
            <div className="mt-4"><FaqForm /></div>
          </details>
        </Card>
      ) : null}
      {faqs.length === 0 ? (
        <EmptyState title="No questions yet" description="Tip: timings, prices, parking and what to bring are the questions people ask most." />
      ) : (
        <ul className="space-y-4">
          {faqs.map((f, i) => (
            <li key={f.id}>
              <Card title={f.question} description={f.isVisible ? undefined : <Badge tone="neutral">Hidden</Badge>} actions={canWrite ? <RowControls kind="faqs" id={f.id} label={`question “${f.question.slice(0, 40)}”`} first={i === 0} last={i === faqs.length - 1} /> : null}>
                <p className="text-small text-muted">{f.answer}</p>
                {canWrite ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-small font-medium">Edit</summary>
                    <div className="mt-4"><FaqForm faq={f} /></div>
                  </details>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
