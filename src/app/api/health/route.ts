import { NextResponse } from "next/server";

/**
 * Liveness probe for load balancers / uptime checks. No secrets, no DB access. `commit` and
 * `environment` are set by the deploy workflow, so CI can verify which build a domain serves.
 */
export function GET() {
  return NextResponse.json(
    { ok: true, commit: process.env.DEPLOY_COMMIT_SHA ?? null, environment: process.env.DEPLOY_ENVIRONMENT ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
