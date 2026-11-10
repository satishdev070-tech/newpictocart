"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { getStockImages } from "@/lib/unsplash";
import { assertPlatformPermission, getPlatformContext, type PlatformContext } from "@/lib/platform/access";
import { INDUSTRY_SLUGS, type IndustrySlug } from "@/features/stores/industries";
import { findMarketplaceTheme } from "../marketplace/catalog";
import { revalidateMarketplaceCatalogue } from "../marketplace/cache";
import { THEME_STYLES } from "../marketplace/types";
import { THEME_KEY_RE, normalizePreset, validateBuiltTheme, type BuiltTheme } from "./schema";
import { fillThemeImages } from "./images";
import { generateThemeForAdmin, screenshotsFromFiles } from "./server/generate";
import { deleteCustomTheme, getCustomTheme, insertCustomTheme, newThemeKey, setCustomThemePublished, updateCustomTheme } from "./server/store";

/**
 * Super Admin → Themes. Every action: validate (zod) → authenticate + authorise
 * (platform.settings.manage, the same key the themes table's RLS checks) → execute → audit.
 */

const PERMISSION = "platform.settings.manage" as const;

async function actor(): Promise<PlatformContext> {
  const ctx = await getPlatformContext();
  if (!ctx) throw new AppError("FORBIDDEN");
  assertPlatformPermission(ctx, PERMISSION);
  return ctx;
}

const record = (ctx: PlatformContext, action: `${string}.${string}`, key: string, metadata: Record<string, string | number | boolean | null> = {}) =>
  audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action, entityType: "theme", entityId: key, metadata });

function refresh(key?: string) {
  revalidatePath("/admin/themes");
  revalidatePath("/dashboard/themes");
  if (key) revalidatePath(`/admin/themes/${key}`);
  revalidateMarketplaceCatalogue();
}

const keySchema = z.object({ key: z.string().regex(THEME_KEY_RE, "Unknown theme") });

const createSchema = z
  .object({
    name: z.string().trim().min(2, "Give the theme a name (2–60 characters).").max(60),
    industry: z.enum(INDUSTRY_SLUGS as [IndustrySlug, ...IndustrySlug[]], { message: "Pick a category." }),
    url: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => v || null)
      .refine((v) => v === null || /^https:\/\//i.test(v), "Use a full https:// address."),
    acknowledge: z.literal("on", { message: "Confirm that only the look will be recreated." }),
  })
  .strict();

/** AI: reference URL and/or screenshots → validated theme with Unsplash photos, saved as a draft. */
export async function createThemeFromReferenceAction(_prev: ActionResult<{ key: string }> | null, fd: FormData): Promise<ActionResult<{ key: string }>> {
  return runAction("platform.theme.generate", async () => {
    const { screenshots: _files, ...fields } = formToObject(fd) as Record<string, unknown>;
    const input = parseInput(createSchema, fields);
    const ctx = await actor();
    const screenshots = await screenshotsFromFiles(fd.getAll("screenshots").filter((f): f is File => f instanceof File));
    if (!input.url && !screenshots.length) throw new AppError("VALIDATION", { fieldErrors: { url: ["Add a website address or at least one screenshot."] } });
    const { theme } = await generateThemeForAdmin(ctx, { name: input.name, industry: input.industry, url: input.url, screenshots });
    const key = await newThemeKey(input.name);
    await insertCustomTheme({ ...theme, key }, { source: "ai", userId: ctx.user.id });
    await record(ctx, "platform.theme_generated", key, { host: theme.reference.host, screenshots: screenshots.length, provider: theme.generation?.provider ?? null, model: theme.generation?.model ?? null });
    refresh();
    return { key };
  });
}

const saveSchema = z.object({ key: z.string().regex(THEME_KEY_RE), theme: z.string().max(300_000), publish: z.enum(["keep", "draft", "publish"]).default("keep") });

/** Theme editor save (custom themes only). The stored key, images and reference metadata are kept. */
export async function saveThemeAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("platform.theme.save", async () => {
    const input = parseInput(saveSchema, formToObject(fd));
    let raw: unknown;
    try {
      raw = JSON.parse(input.theme);
    } catch {
      throw new AppError("VALIDATION", { fieldErrors: { _form: ["The theme couldn't be read. Reload the editor and try again."] } });
    }
    const ctx = await actor();
    const stored = await getCustomTheme(input.key);
    if (!stored) throw new AppError("NOT_FOUND");
    const edited = raw as Partial<BuiltTheme>;
    const res = validateBuiltTheme({ ...stored.theme, ...edited, key: stored.theme.key, images: edited.images ?? stored.theme.images, reference: stored.theme.reference, generation: stored.theme.generation });
    if (!res.ok) throw new AppError("VALIDATION", { fieldErrors: { _form: [`The theme isn't valid: ${res.issues.slice(0, 3).join("; ")}`] } });
    await updateCustomTheme(res.theme, input.publish === "keep" ? undefined : input.publish === "publish");
    await record(ctx, "platform.theme_saved", input.key, { publish: input.publish });
    refresh(input.key);
  });
}

export async function setThemePublishedAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("platform.theme.publish", async () => {
    const input = parseInput(keySchema.extend({ publish: z.enum(["yes", "no"]) }), formToObject(fd));
    const ctx = await actor();
    const stored = await getCustomTheme(input.key);
    if (!stored) throw new AppError("NOT_FOUND", { message: "Built-in themes are always published." });
    if (input.publish === "yes") {
      const res = validateBuiltTheme(stored.theme);
      if (!res.ok) throw new AppError("VALIDATION", { fieldErrors: { _form: ["Fix the theme in the editor before publishing."] } });
    }
    await setCustomThemePublished(input.key, input.publish === "yes");
    await record(ctx, input.publish === "yes" ? "platform.theme_published" : "platform.theme_unpublished", input.key);
    refresh(input.key);
  });
}

/** Copy of a built-in or custom theme as a new custom draft (with fresh Unsplash photos). */
export async function duplicateThemeAction(_prev: ActionResult<{ key: string }> | null, fd: FormData): Promise<ActionResult<{ key: string }>> {
  return runAction("platform.theme.duplicate", async () => {
    const input = parseInput(keySchema, formToObject(fd));
    const ctx = await actor();
    const builtIn = findMarketplaceTheme(input.key);
    const custom = builtIn ? null : await getCustomTheme(input.key);
    if (!builtIn && !custom) throw new AppError("NOT_FOUND");
    const name = `${builtIn?.name ?? custom!.theme.name} copy`.slice(0, 60);
    const key = await newThemeKey(name);
    const base: BuiltTheme = builtIn
      ? {
          key,
          name,
          tagline: builtIn.tagline.slice(0, 160),
          description: builtIn.description.slice(0, 2000),
          industry: builtIn.industry,
          style: (THEME_STYLES as readonly string[]).includes(builtIn.style) ? builtIn.style : "modern",
          bestFor: builtIn.bestFor.slice(0, 6).map((s) => s.slice(0, 40)),
          features: builtIn.features.slice(0, 8).map((s) => s.slice(0, 60)),
          preset: normalizePreset(builtIn.preset) as BuiltTheme["preset"],
          images: [],
          reference: { url: null, host: null, screenshots: 0 },
          generation: null,
        }
      : { ...custom!.theme, key, name };
    if (!base.images.length) base.images = await fillThemeImages(base.preset, base.industry, (c, s, n) => getStockImages(c, s, n));
    const res = validateBuiltTheme(base);
    if (!res.ok) throw new AppError("INTERNAL", { context: { issues: res.issues.slice(0, 5) } });
    await insertCustomTheme(res.theme, { source: "duplicate", userId: ctx.user.id });
    await record(ctx, "platform.theme_duplicated", key, { from: input.key });
    refresh();
    return { key };
  });
}

export async function deleteThemeAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("platform.theme.delete", async () => {
    const input = parseInput(keySchema.extend({ confirm: z.literal("yes") }), formToObject(fd));
    const ctx = await actor();
    if (findMarketplaceTheme(input.key)) throw new AppError("FORBIDDEN", { message: "Built-in themes can't be deleted." });
    await deleteCustomTheme(input.key);
    await record(ctx, "platform.theme_deleted", input.key);
    refresh();
  });
}
