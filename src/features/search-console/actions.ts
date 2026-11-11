"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { assertPlatformPermission, getPlatformContext, type PlatformContext } from "@/lib/platform/access";
import { GSC_DOMAINS, GSC_MAX_FILE_BYTES, normalizeGscDnsValue, validateGscFile, type GscDnsStatus } from "./verification";
import { checkGscDelivery, checkGscDns, removeGscDns, removeGscFile, saveGscDns, saveGscFile } from "./server/store";

/**
 * Super Admin actions for Google Search Console verification. Order: validate → authenticate +
 * authorize (platform.settings.manage = super_admin only) → rate limit → execute (RLS) → audit.
 */

const PAGE = "/admin/branding";
const domainSchema = z.object({ domain: z.enum(GSC_DOMAINS) });

async function superAdmin(): Promise<PlatformContext> {
  const ctx = await getPlatformContext();
  if (!ctx) throw new AppError("FORBIDDEN");
  assertPlatformPermission(ctx, "platform.settings.manage");
  return ctx;
}

const fileError = (message: string) => new AppError("VALIDATION", { fieldErrors: { file: [message] } });

export async function uploadGscFileAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("platform.searchConsole.uploadFile", async () => {
    const { domain } = parseInput(domainSchema, formToObject(fd));
    const ctx = await superAdmin();
    await rateLimit("platform-gsc-write", ctx.user.id, 20, 600);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) throw fileError("Choose the googleXXXXXXXXXXXXXXXX.html file from Search Console.");
    // Size gate BEFORE reading the body.
    if (file.size > GSC_MAX_FILE_BYTES) throw fileError("File is too large. Google's verification file is a single line (max 10 KB).");
    const checked = validateGscFile({ name: file.name, size: file.size, text: await file.text() });
    if (!checked.ok) throw fileError(checked.message);
    await saveGscFile(ctx, domain, { filename: checked.filename, content: checked.content });
    revalidatePath(PAGE);
  });
}

export async function removeGscFileAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("platform.searchConsole.removeFile", async () => {
    const { domain } = parseInput(domainSchema, formToObject(fd));
    const ctx = await superAdmin();
    await rateLimit("platform-gsc-write", ctx.user.id, 20, 600);
    await removeGscFile(ctx, domain);
    revalidatePath(PAGE);
  });
}

const dnsSchema = domainSchema.extend({
  value: z
    .string({ error: "Paste the TXT value from Search Console." })
    .max(200)
    .transform((v, c) => {
      const n = normalizeGscDnsValue(v);
      if (!n) {
        c.addIssue({ code: "custom", message: "Paste the value Google shows, like google-site-verification=AbC123…" });
        return z.NEVER;
      }
      return n;
    }),
});

export async function saveGscDnsAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("platform.searchConsole.saveDns", async () => {
    const { domain, value } = parseInput(dnsSchema, formToObject(fd));
    const ctx = await superAdmin();
    await rateLimit("platform-gsc-write", ctx.user.id, 20, 600);
    await saveGscDns(ctx, domain, value);
    revalidatePath(PAGE);
  });
}

export async function removeGscDnsAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("platform.searchConsole.removeDns", async () => {
    const { domain } = parseInput(domainSchema, formToObject(fd));
    const ctx = await superAdmin();
    await rateLimit("platform-gsc-write", ctx.user.id, 20, 600);
    await removeGscDns(ctx, domain);
    revalidatePath(PAGE);
  });
}

export async function checkGscDeliveryAction(_prev: ActionResult<{ ok: boolean; reason: string | null; url: string }> | null, fd: FormData): Promise<ActionResult<{ ok: boolean; reason: string | null; url: string }>> {
  return runAction("platform.searchConsole.checkDelivery", async () => {
    const { domain } = parseInput(domainSchema, formToObject(fd));
    const ctx = await superAdmin();
    await rateLimit("platform-gsc-check", ctx.user.id, 10, 60);
    const result = await checkGscDelivery(ctx, domain);
    revalidatePath(PAGE);
    return result;
  });
}

export async function checkGscDnsAction(_prev: ActionResult<GscDnsStatus> | null, fd: FormData): Promise<ActionResult<GscDnsStatus>> {
  return runAction("platform.searchConsole.checkDns", async () => {
    const { domain } = parseInput(domainSchema, formToObject(fd));
    const ctx = await superAdmin();
    await rateLimit("platform-gsc-check", ctx.user.id, 10, 60);
    const status = await checkGscDns(ctx, domain);
    revalidatePath(PAGE);
    return status;
  });
}
