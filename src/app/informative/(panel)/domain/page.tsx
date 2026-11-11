import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/layout";
import { requireInformativeTenant } from "@/features/informative/server/context";
import { storeOrigin, storeSubdomain } from "@/lib/platform/urls";

export const metadata: Metadata = { title: "Domain" };

/**
 * Plan: "Reuse the existing subdomain/custom-domain feature if it exists; otherwise show the
 * subdomain only." Custom domains for informative sites are an open product question, so v1 shows
 * the subdomain (see docs/informative/PROGRESS.md, M5).
 */
export default async function InformativeDomainPage() {
  const ctx = await requireInformativeTenant();
  const host = storeSubdomain(ctx.tenantSlug);
  return (
    <>
      <PageHeader title="Domain" description="Where people find your website." />
      <Card title="Your website address">
        <p className="flex flex-wrap items-center gap-2 text-body">
          <span className="font-medium">{host}</span>
          <a href={storeOrigin(host)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-small font-medium text-accent hover:underline">
            Open <ExternalLink aria-hidden className="size-3.5" />
          </a>
        </p>
        <p className="mt-3 text-small text-muted">Custom domains (like www.yourbusiness.in) are coming soon for websites.</p>
      </Card>
    </>
  );
}
