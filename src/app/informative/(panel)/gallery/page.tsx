import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { GalleryItemForm, GalleryUploader } from "@/features/informative/panel/content-forms";
import { RowControls } from "@/features/informative/panel/ui";
import { requireInformativeTenant } from "@/features/informative/server/context";
import { listGallery } from "@/features/informative/server/repo";
import { assetUrl } from "@/lib/storage/assets";

export const metadata: Metadata = { title: "Gallery" };

export default async function InformativeGalleryPage() {
  const ctx = await requireInformativeTenant();
  const items = await listGallery(ctx);
  const canWrite = ctx.permissions.has("content.write");
  return (
    <>
      <PageHeader title="Gallery" description="Photos of your work, space and team." />
      {canWrite ? <div className="mb-6"><GalleryUploader /></div> : null}
      {items.length === 0 ? (
        <EmptyState title="No photos yet" description="Tip: before-and-after shots and photos of your space build trust fastest." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((g, i) => {
            const url = assetUrl(g.imagePath);
            return (
              <li key={g.id}>
                <Card>
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- store asset thumbnail
                    <img src={url} alt={g.alt ?? ""} width={480} height={320} loading="lazy" className="mb-3 aspect-[3/2] w-full rounded-md object-cover" />
                  ) : null}
                  {canWrite ? (
                    <>
                      <details>
                        <summary className="cursor-pointer text-small font-medium">Caption, alt text, album</summary>
                        <div className="mt-3"><GalleryItemForm item={g} /></div>
                      </details>
                      <div className="mt-3"><RowControls kind="gallery" id={g.id} label={g.caption ?? `photo ${i + 1}`} first={i === 0} last={i === items.length - 1} /></div>
                    </>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
