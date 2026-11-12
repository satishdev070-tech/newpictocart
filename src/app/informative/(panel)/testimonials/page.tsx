import type { Metadata } from "next";
import { Badge, Card, PageHeader } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { TestimonialForm } from "@/features/informative/panel/content-forms";
import { RowControls } from "@/features/informative/panel/ui";
import { requireInformativeTenant } from "@/features/informative/server/context";
import { listTestimonials } from "@/features/informative/server/repo";
import { assetUrl } from "@/lib/storage/assets";

export const metadata: Metadata = { title: "Testimonials" };

export default async function InformativeTestimonialsPage() {
  const ctx = await requireInformativeTenant();
  const items = await listTestimonials(ctx);
  const canWrite = ctx.permissions.has("content.write");
  return (
    <>
      <PageHeader title="Testimonials" description="What your clients say. Your website shows only what you enter here." />
      {canWrite ? (
        <Card title="Add a testimonial" className="mb-6">
          <details>
            <summary className="cursor-pointer text-small font-medium text-accent">Add testimonial</summary>
            <div className="mt-4"><TestimonialForm /></div>
          </details>
        </Card>
      ) : null}
      {items.length === 0 ? (
        <EmptyState title="No testimonials yet" description="Tip: ask your three happiest clients for one or two sentences." />
      ) : (
        <ul className="space-y-4">
          {items.map((t, i) => (
            <li key={t.id}>
              <Card
                title={<span>{t.authorName} · <span aria-label={`${t.rating} out of 5`}>{"★".repeat(t.rating)}</span></span>}
                description={t.isVisible ? undefined : <Badge tone="neutral">Hidden</Badge>}
                actions={canWrite ? <RowControls kind="testimonials" id={t.id} label={`testimonial from ${t.authorName}`} first={i === 0} last={i === items.length - 1} /> : null}
              >
                <p className="text-small">“{t.text}”</p>
                {canWrite ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-small font-medium">Edit</summary>
                    <div className="mt-4"><TestimonialForm item={t} photoUrl={assetUrl(t.authorPhotoPath)} /></div>
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
