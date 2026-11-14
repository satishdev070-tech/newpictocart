import { NextResponse } from "next/server";

/**
 * Liveness probe for load balancers / uptime checks. No secrets, no DB access. `commit`,
 * `environment` and `role` are set by the deploy workflow, so CI can verify which build (and, with
 * several Workers serving one build, which Worker: `platform` | `storefront`) answered a host.
 */
export function GET() {
  return NextResponse.json(
    {
      ok: true,
      commit: process.env.DEPLOY_COMMIT_SHA ?? null,
      environment: process.env.DEPLOY_ENVIRONMENT ?? null,
      role: process.env.DEPLOY_WORKER_ROLE ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
