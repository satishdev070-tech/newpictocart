import "server-only";
import { getAiCreditBalance, getAiCreditCatalog } from "@/features/ai-credits/server";
import { BUSINESS_COACH_FALLBACK_CREDITS, BUSINESS_COACH_KIND } from "../schemas";

export async function getBusinessCoachCardProps(tenantId: string): Promise<{ creditCost: number; balance: number | null }> {
  const [catalog, balance] = await Promise.all([getAiCreditCatalog(), getAiCreditBalance(tenantId)]);
  const row = catalog.costs.find((c) => c.kind === BUSINESS_COACH_KIND);
  return { creditCost: row?.credits ?? BUSINESS_COACH_FALLBACK_CREDITS, balance };
}
