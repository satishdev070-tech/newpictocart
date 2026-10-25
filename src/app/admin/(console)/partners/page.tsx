import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/layout";
import { requirePlatform } from "@/lib/platform/access";
import { PARTNER_TABS, PARTNER_TAB_LABEL, partnersPageSchema } from "@/features/partners/schemas";
import { CreatePartnerDirectButton, InvitePartnerButton } from "@/features/partners/components/forms";
import { CodesTab, DemoShopsTab, LicensesTab, PartnersTab, RequestsTab } from "@/features/partners/components/tabs";
import { TabNav } from "@/features/partners/components/ui";

export const metadata: Metadata = { title: "All partners" };

export default async function PartnersPage({ searchParams }: PageProps<"/admin/partners">) {
  await requirePlatform("platform.partners.manage");
  const f = partnersPageSchema.parse(await searchParams);
  return (
    <div>
      <PageHeader
        title="All partners"
        description="Agencies, freelancers, interns and agents who sell Pictocart: licences, demo shops, credit codes and commissions."
        actions={
          <>
            <CreatePartnerDirectButton />
            <InvitePartnerButton />
          </>
        }
      />
      <TabNav label="Partner sections" active={f.tab} tabs={PARTNER_TABS.map((t) => ({ key: t, label: PARTNER_TAB_LABEL[t], href: t === "partners" ? "/admin/partners" : `/admin/partners?tab=${t}` }))} />
      {f.tab === "partners" ? <PartnersTab q={f.q} /> : null}
      {f.tab === "requests" ? <RequestsTab /> : null}
      {f.tab === "licenses" ? <LicensesTab q={f.q} status={f.status} /> : null}
      {f.tab === "demo" ? <DemoShopsTab /> : null}
      {f.tab === "codes" ? <CodesTab /> : null}
    </div>
  );
}
