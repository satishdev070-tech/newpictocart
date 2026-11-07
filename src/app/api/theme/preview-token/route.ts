import { NextResponse } from "next/server";
import { assertPermission, requireTenant } from "@/lib/tenant/membership";
import { storeOrigin, storeSubdomain } from "@/lib/platform/urls";
import { previewEntryUrl } from "@/features/theme/preview";
import { createPreviewToken } from "@/features/theme/server/preview";
import { isNextControlFlowError } from "@/lib/next/control-flow";
import { AppError, HTTP_STATUS, toPublicError } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";

/**
 * Mint a draft-theme preview entry URL (same as refreshPreviewUrlAction).
 * Route-handler path so Theme Editor can refresh tokens without relying on RSC server actions
 * (vinext / Workers). Auth = seller session + theme.edit.
 */
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const ctx = await requireTenant();
    assertPermission(ctx, "theme.edit");
    const { token, expiresAt } = createPreviewToken(ctx.tenantId, ctx.user.id);
    return NextResponse.json(
      { ok: true as const, url: previewEntryUrl(storeOrigin(storeSubdomain(ctx.tenantSlug)), token), expiresAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    if (isNextControlFlowError(err)) throw err;
    if (err instanceof AppError) {
      return NextResponse.json({ ok: false as const, error: toPublicError(err) }, { status: HTTP_STATUS[err.code], headers: { "Cache-Control": "no-store" } });
    }
    logger.error("theme.preview_token_mint_failed", { error: err });
    return NextResponse.json({ ok: false as const, error: toPublicError(err) }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
