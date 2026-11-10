import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/layout";
import { requirePlatform } from "@/lib/platform/access";
import { getPlatformAiCreditOverview } from "@/features/ai-credits/server";
import { AiCreditAdminPanel } from "@/features/ai-credits/components";

export const metadata: Metadata = { title: "AI credits" };

export default async function AiCreditsPage() {
  await requirePlatform("platform.settings.manage");
  const credits = await getPlatformAiCreditOverview();
  return (
    <div className="space-y-6">
      <PageHeader title="AI credits" description="Generate one-time credit codes, review purchases and ledger activity, verify payments, and make audited manual adjustments." />
      <AiCreditAdminPanel {...credits} />
    </div>
  );
}
