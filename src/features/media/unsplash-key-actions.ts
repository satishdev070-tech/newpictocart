"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { assertPlatformPermission, getPlatformContext } from "@/lib/platform/access";
import { clearAppCredential, saveAppCredential } from "@/features/platform-apps/server";
import { describeUnsplashTest, getUnsplashAccessKey, testUnsplashKey } from "./unsplash/key";
import { unsplashKeySchema } from "./unsplash/key-schema";

/**
 * Admin → Media library: save, test and remove the platform's Unsplash Access Key
 * (platform.settings.manage). The key is write-only: it is tested against the API before it is
 * stored encrypted, never returned to the browser, and only "saved / tested" is audited.
 */

const PATH = "/admin/media";
const form = (message: string, field = "_form") => new AppError("VALIDATION", { message, fieldErrors: { [field]: [message] } });

async function actor() {
  const ctx = await getPlatformContext();
  if (!ctx) throw new AppError("FORBIDDEN");
  assertPlatformPermission(ctx, "platform.settings.manage");
  return ctx;
}

function refresh() {
  // Cached search results were fetched with the previous key (or the fallbacks): refetch them.
  revalidateTag("unsplash", { expire: 0 });
  revalidatePath(PATH);
}

export async function saveUnsplashKeyAction(_prev: ActionResult<{ message: string }> | null, fd: FormData): Promise<ActionResult<{ message: string }>> {
  return runAction("platform.unsplash.saveKey", async () => {
    const { accessKey } = parseInput(unsplashKeySchema, formToObject(fd));
    const ctx = await actor();
    await rateLimit("platform-unsplash-key", ctx.user.id, 10, 600);
    const test = await testUnsplashKey(accessKey);
    if (!test.ok && test.reason === "invalid") throw form(describeUnsplashTest(test), "accessKey");
    if (!test.ok && test.reason === "unavailable") throw form(`${describeUnsplashTest(test)} The key was not saved.`);
    try {
      await saveAppCredential(ctx, { provider: "unsplash", secret: accessKey });
    } catch (error) {
      // 23514: the provider check still lacks "unsplash" (migration 4000 not applied yet).
      const code = error instanceof AppError && error.cause && typeof error.cause === "object" && "code" in error.cause ? String(error.cause.code) : null;
      if (code === "23514") throw form("The key works, but this database can't store it yet: apply migration 20261025004000_unsplash_credential.sql first. Until then, UNSPLASH_ACCESS_KEY is used.");
      throw error;
    }
    refresh();
    return { message: `Saved. ${describeUnsplashTest(test)}` };
  });
}

export async function testUnsplashKeyAction(_prev: ActionResult<{ message: string }> | null, _fd: FormData): Promise<ActionResult<{ message: string }>> {
  return runAction("platform.unsplash.testKey", async () => {
    const ctx = await actor();
    await rateLimit("platform-unsplash-key", ctx.user.id, 10, 600);
    const key = await getUnsplashAccessKey();
    if (!key) throw form("No Unsplash Access Key is set yet. Paste one above and save it.");
    const test = await testUnsplashKey(key);
    await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: "platform_app_credential.tested", entityType: "platform_app_credential", entityId: "unsplash", metadata: { ok: test.ok, reason: test.ok ? null : test.reason } });
    if (!test.ok) throw form(describeUnsplashTest(test));
    return { message: describeUnsplashTest(test) };
  });
}

export async function clearUnsplashKeyAction(_prev: ActionResult | null, _fd: FormData): Promise<ActionResult> {
  return runAction("platform.unsplash.clearKey", async () => {
    const ctx = await actor();
    await clearAppCredential(ctx, "unsplash");
    refresh();
  });
}
