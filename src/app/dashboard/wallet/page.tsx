import type { Metadata } from "next";
import { can, requireTenantPermission } from "@/lib/tenant/membership";
import { toMinor } from "@/lib/money";
import { savingsMinor } from "@/features/platform-finance/calc";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAiCreditOverview } from "@/features/ai-credits/server";
import { AiWalletPageView } from "@/features/ai-credits/wallet-ui";
import { resolvePlatformAiGateway } from "@/features/ai-credits/platform-gateways";
import { getAiWalletSummary } from "@/features/seller-ai/server";

export const metadata: Metadata = { title: "AI Credits Wallet" };

/** Freelancer hourly rate from platform settings (authenticated read). Null if unavailable. */
async function freelancerHourlyMinor(): Promise<number | null> {
  const { data, error } = await (await createSupabaseServerClient()).from("ai_credit_settings").select("freelancer_hourly").eq("id", 1).maybeSingle();
  if (error || data?.freelancer_hourly == null) return null;
  try {
    return toMinor(String(data.freelancer_hourly));
  } catch {
    return null;
  }
}

export default async function AiWalletPage() {
  const ctx = await requireTenantPermission("marketing.read");
  const [summary, credits, hourly, gateway] = await Promise.all([
    getAiWalletSummary(ctx.tenantId),
    getAiCreditOverview(ctx.tenantId),
    freelancerHourlyMinor(),
    resolvePlatformAiGateway(),
  ]);
  const moneySavedMinor = summary.available && hourly != null ? savingsMinor(summary.minutesSaved, { freelancerHourlyMinor: hourly }) : 0;

  return (
    <AiWalletPageView
      summary={summary}
      moneySavedMinor={moneySavedMinor}
      available={credits.available}
      balance={credits.balance}
      ledger={credits.ledger}
      purchases={credits.purchases}
      catalog={credits.catalog}
      canManage={can(ctx, "billing.manage")}
      gatewayConfigured={Boolean(gateway)}
      storeName={ctx.tenantName}
    />
  );
}
