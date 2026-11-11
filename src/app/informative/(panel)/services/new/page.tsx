import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui/layout";
import { ServiceForm } from "@/features/informative/panel/service-form";
import { requireInformativeTenant } from "@/features/informative/server/context";

export const metadata: Metadata = { title: "Add service" };

export default async function NewServicePage() {
  const ctx = await requireInformativeTenant();
  if (!ctx.permissions.has("content.write")) redirect("/informative/services");
  return (
    <>
      <PageHeader title="Add service" back={<Link href="/informative/services" className="hover:underline">← Services</Link>} />
      <Card><ServiceForm /></Card>
    </>
  );
}
