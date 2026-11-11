import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { Badge, Card, PageHeader, StatCard } from "@/components/ui/layout";
import { buttonClass } from "@/components/ui/button";
import { PublishForm } from "@/features/informative/panel/publish-form";
import { requireInformativeTenant } from "@/features/informative/server/context";
import * as repo from "@/features/informative/server/repo";
import { findInformativeTheme } from "@/features/informative/themes/registry";
import { storeOrigin, storeSubdomain } from "@/lib/platform/urls";

export const metadata: Metadata = { title: "Dashboard" };

/** Informative dashboard: setup checklist, enquiry counts, last 5 enquiries, status, View / Publish. */
export default async function InformativeDashboardPage({ searchParams }: PageProps<"/informative/dashboard">) {
  const ctx = await requireInformativeTenant();
  const canLeads = ctx.permissions.has("customers.read");
  const [site, services, counts, latest] = await Promise.all([
    repo.getSite(ctx),
    repo.listServices(ctx),
    canLeads ? repo.countEnquiriesByStatus(ctx) : Promise.resolve(null),
    canLeads ? repo.listEnquiries(ctx, { page: 1 }) : Promise.resolve(null),
  ]);
  const welcome = (await searchParams).welcome === "1";
  const siteUrl = storeOrigin(storeSubdomain(ctx.tenantSlug));
  if (!site) {
    return <PageHeader title="Dashboard" description="Your website is being set up. Refresh in a moment." />;
  }
  const ownServices = services.filter((s) => s.isActive && !s.isSample).length;
  const checklist = [
    { done: Boolean(site.logoPath), label: "Add your logo", href: "/informative/appearance" },
    { done: ownServices >= 3, label: `Add 3 or more services (${ownServices}/3)`, href: "/informative/services" },
    { done: Boolean(site.contact.phone && site.contact.email && site.contact.city), label: "Complete your contact info", href: "/informative/business" },
    { done: Boolean(findInformativeTheme(site.themeId)), label: "Choose a design", href: "/informative/appearance" },
    { done: site.status === "PUBLISHED", label: "Publish your website", href: "#publish" },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const canPublish = ctx.permissions.has("theme.publish");

  return (
    <>
      <PageHeader
        title={site.businessName}
        description={
          <span className="inline-flex items-center gap-2">
            Status: {site.status === "PUBLISHED" ? <Badge tone="success">Live</Badge> : <Badge tone="neutral">Draft · only you can see it</Badge>}
          </span>
        }
        actions={
          <a href={siteUrl} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "secondary" })}>
            <ExternalLink aria-hidden /> View site
          </a>
        }
      />
      {welcome ? (
        <p role="status" className="mb-6 rounded-lg border border-success/25 bg-success/10 px-4 py-3 text-small text-success">
          Welcome! Your website is ready as a private draft. Finish the checklist below, then publish when you&apos;re happy.
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Setup checklist" description={`${doneCount} of ${checklist.length} done`} className="lg:col-span-2">
          <ol className="divide-y divide-border">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-center justify-between gap-3 py-3">
                <span className="flex items-center gap-3">
                  {c.done ? <CheckCircle2 aria-hidden className="size-5 text-success" /> : <Circle aria-hidden className="size-5 text-muted" />}
                  <span className={c.done ? "text-muted line-through" : ""}>{c.label}</span>
                  <span className="sr-only">{c.done ? "(done)" : "(to do)"}</span>
                </span>
                {!c.done && c.href !== "#publish" ? (
                  <Link href={c.href} className="text-small font-medium text-accent hover:underline">
                    Do it
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
          <div id="publish" className="mt-4 border-t border-border pt-4">
            {canPublish ? <PublishForm status={site.status} /> : <p className="text-small text-muted">Ask the owner to publish the website.</p>}
          </div>
        </Card>
        <div className="space-y-6">
          {counts ? (
            <div className="grid grid-cols-2 gap-4">
              <StatCard label="New enquiries" value={counts.NEW} tone="peach" />
              <StatCard label="Converted" value={counts.CONVERTED} tone="mint" />
            </div>
          ) : null}
          {latest ? (
            <Card title="Latest enquiries" actions={<Link href="/informative/enquiries" className="text-small font-medium text-accent hover:underline">All enquiries</Link>}>
              {latest.rows.length ? (
                <ul className="divide-y divide-border">
                  {latest.rows.slice(0, 5).map((e) => (
                    <li key={e.id} className="py-2.5">
                      <Link href={`/informative/enquiries?open=${e.id}`} className="font-medium hover:underline">{e.name}</Link>
                      <p className="text-caption text-muted">
                        {new Date(e.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {e.status.toLowerCase()}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-small text-muted">No enquiries yet. They appear here when visitors use your contact form.</p>
              )}
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
