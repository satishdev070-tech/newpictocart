import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, PageHeader, Table, td, th } from "@/components/ui/layout";
import { buttonClass } from "@/components/ui/button";
import { RowControls } from "@/features/informative/panel/ui";
import { requireInformativeTenant } from "@/features/informative/server/context";
import { listPages } from "@/features/informative/server/repo";

export const metadata: Metadata = { title: "Pages" };

/** Home / About / Services / Contact plus custom pages; each opens the section editor. */
export default async function InformativePagesPage() {
  const ctx = await requireInformativeTenant();
  const pages = await listPages(ctx);
  const canWrite = ctx.permissions.has("content.write");
  return (
    <>
      <PageHeader title="Pages" description="Show, hide, reorder and edit the sections of each page." actions={canWrite ? <Link href="/informative/pages/new" className={buttonClass()}>Add page</Link> : null} />
      <Card>
        <Table caption="Pages">
          <thead>
            <tr>
              <th className={th}>Page</th>
              <th className={th}>Address</th>
              <th className={th}>Status</th>
              {canWrite ? <th className={th}><span className="sr-only">Actions</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {pages.map((p, i) => (
              <tr key={p.id}>
                <td className={td}>
                  <Link href={`/informative/pages/${p.id}`} className="font-medium hover:underline">{p.title}</Link>
                  <p className="text-caption text-muted">{p.sections.length} sections</p>
                </td>
                <td className={td}>/{p.type === "HOME" ? "" : p.slug}</td>
                <td className={td}>{p.isPublished ? <Badge tone="success">Published</Badge> : <Badge tone="neutral">Hidden</Badge>}</td>
                {canWrite ? (
                  <td className={td}>
                    <RowControls kind="pages" id={p.id} label={p.title} first={i === 0} last={i === pages.length - 1} canDelete={p.type === "CUSTOM"} />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
