import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui/layout";
import { PageForm } from "@/features/informative/panel/page-form";
import { SectionEditor } from "@/features/informative/panel/section-editor";
import { requireInformativeTenant } from "@/features/informative/server/context";
import { getPage } from "@/features/informative/server/repo";

export const metadata: Metadata = { title: "Edit page" };

export default async function EditInformativePage({ params }: PageProps<"/informative/pages/[id]">) {
  const ctx = await requireInformativeTenant();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const page = await getPage(ctx, id);
  if (!page) notFound();
  const canWrite = ctx.permissions.has("content.write");
  return (
    <>
      <PageHeader title={page.title} back={<Link href="/informative/pages" className="hover:underline">← Pages</Link>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Sections" className="lg:col-span-2">
          {canWrite ? <SectionEditor pageId={page.id} initial={page.sections} /> : <p className="text-small text-muted">You can view but not edit pages.</p>}
        </Card>
        <Card title="Page settings">{canWrite ? <PageForm page={page} /> : null}</Card>
      </div>
    </>
  );
}
