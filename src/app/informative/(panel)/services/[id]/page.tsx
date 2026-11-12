import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui/layout";
import { ServiceForm } from "@/features/informative/panel/service-form";
import { requireInformativeTenant } from "@/features/informative/server/context";
import { getService } from "@/features/informative/server/repo";
import { assetUrl } from "@/lib/storage/assets";

export const metadata: Metadata = { title: "Edit service" };

export default async function EditServicePage({ params }: PageProps<"/informative/services/[id]">) {
  const ctx = await requireInformativeTenant();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const service = await getService(ctx, id);
  if (!service) notFound();
  return (
    <>
      <PageHeader title={service.name} description={service.isSample ? "This is a sample. Edit it to make it yours." : undefined} back={<Link href="/informative/services" className="hover:underline">← Services</Link>} />
      <Card><ServiceForm service={service} imageUrl={assetUrl(service.imagePath)} /></Card>
    </>
  );
}
