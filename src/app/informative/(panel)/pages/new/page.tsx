import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui/layout";
import { PageForm } from "@/features/informative/panel/page-form";
import { requireInformativeTenant } from "@/features/informative/server/context";

export const metadata: Metadata = { title: "Add page" };

export default async function NewInformativePage() {
  const ctx = await requireInformativeTenant();
  if (!ctx.permissions.has("content.write")) redirect("/informative/pages");
  return (
    <>
      <PageHeader title="Add a page" back={<Link href="/informative/pages" className="hover:underline">← Pages</Link>} />
      <Card><PageForm /></Card>
    </>
  );
}
