import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/features/domains/cron-auth";
import { serverEnv } from "@/lib/env/server";
import { createPreviewToken, diagnosePreviewToken } from "@/features/theme/server/preview";

/**
 * Ops probe: mint a preview token with this Worker's APP_SECRET, then verify it in-process.
 * Authorization: Bearer CRON_SECRET (same as other /api/cron/* routes).
 *
 * Optional query: `token` + `tenantId` — diagnose an externally minted token against this
 * Worker's secret (does not echo the token). Use to distinguish dashboard mint vs /preview verify
 * mismatches without reading Worker secrets.
 */
export const dynamic = "force-dynamic";

const SAMPLE_TENANT = "00000000-0000-4000-8000-000000000001";
const SAMPLE_USER = "00000000-0000-4000-8000-000000000002";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), serverEnv().CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const { token: minted, expiresAt } = createPreviewToken(SAMPLE_TENANT, SAMPLE_USER);
  const roundTrip = diagnosePreviewToken(minted, SAMPLE_TENANT);
  const wrongTenant = diagnosePreviewToken(minted, "00000000-0000-4000-8000-000000000099");
  const garbage = diagnosePreviewToken("not-a-token", SAMPLE_TENANT);

  const externalToken = request.nextUrl.searchParams.get("token");
  const externalTenant = request.nextUrl.searchParams.get("tenantId");
  const external =
    externalToken && externalTenant
      ? diagnosePreviewToken(externalToken, externalTenant)
      : null;

  const ok = roundTrip.ok && !wrongTenant.ok && wrongTenant.reason === "tenant_mismatch" && !garbage.ok;
  return NextResponse.json(
    {
      ok,
      appSecretPresent: Boolean(serverEnv().APP_SECRET),
      mintVerify: roundTrip.ok ? "ok" : roundTrip.reason,
      expiresAt,
      controls: {
        wrongTenant: wrongTenant.ok ? "ok" : wrongTenant.reason,
        garbage: garbage.ok ? "ok" : garbage.reason,
      },
      external: external ? (external.ok ? { ok: true as const } : { ok: false as const, reason: external.reason }) : undefined,
    },
    { status: ok ? 200 : 500, headers: { "Cache-Control": "no-store" } },
  );
}
