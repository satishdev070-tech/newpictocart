import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";
import { buildAccountExport } from "@/features/account/server";
import { exportFilename } from "@/features/account/schemas";

/** "Export your data" (My Profile → Data & privacy): JSON download of the signed-in person's own data. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    await rateLimit("account-export", user.id, 10, 3600);
  } catch (err) {
    if (err instanceof AppError && err.code === "RATE_LIMITED") return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    throw err;
  }
  const body = await buildAccountExport({ id: user.id, email: user.email });
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date())}"`,
      "cache-control": "private, no-store",
    },
  });
}
