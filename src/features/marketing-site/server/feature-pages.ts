import "server-only";
import { cache } from "react";
import { revalidatePath } from "next/cache";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";
import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { mapDbError } from "@/lib/supabase/errors";
import { assertPlatformPermission, type PlatformContext } from "@/lib/platform/access";
import type { Json } from "@/lib/supabase/database.types";
import { cachedPublic, revalidatePublicTags } from "@/lib/cache/public-cache";
import {
  DEFAULT_FEATURE_PAGES,
  FEATURE_PAGES_KEY,
  featurePageBySlug,
  parseFeaturePages,
  featurePagesDocumentSchema,
  type FeaturePage,
  type FeaturePagesDocument,
} from "../feature-pages";

export const FEATURE_PAGES_TAG = "platform-feature-pages";

class FeaturePagesUnavailable extends Error {}

async function load(): Promise<FeaturePagesDocument> {
  const { data, error } = await createSupabasePublicClient().from("platform_settings").select("value").eq("key", FEATURE_PAGES_KEY).maybeSingle();
  if (error) {
    logger.warn("marketing.feature_pages_unavailable", { code: error.code });
    throw new FeaturePagesUnavailable();
  }
  return parseFeaturePages(data?.value ?? null);
}

const cached = cachedPublic("platform-feature-pages", load, {
  tags: [FEATURE_PAGES_TAG],
  revalidateSeconds: 300,
  keyPrefix: "pub:v1",
});

export const getFeaturePages = cache(async (): Promise<FeaturePagesDocument> => {
  try {
    return await cached();
  } catch {
    return DEFAULT_FEATURE_PAGES;
  }
});

export const getFeaturePage = cache(async (slug: string): Promise<FeaturePage | null> => {
  const doc = await getFeaturePages();
  return featurePageBySlug(doc, slug);
});

export async function loadFeaturePagesForAdmin(): Promise<{ content: FeaturePagesDocument; stored: boolean }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("platform_settings").select("value").eq("key", FEATURE_PAGES_KEY).maybeSingle();
  if (error) throw mapDbError(error);
  return { content: parseFeaturePages(data?.value ?? null), stored: Boolean(data) };
}

export async function saveFeaturePagesContent(ctx: PlatformContext, value: unknown): Promise<void> {
  assertPlatformPermission(ctx, "platform.settings.manage");
  const parsed = featurePagesDocumentSchema.safeParse(value);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new AppError("VALIDATION", {
      fieldErrors: { _form: [first ? `${first.path.join(".") || "content"}: ${first.message}` : "Check the highlighted fields"] },
    });
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("platform_settings")
    .upsert(
      { key: FEATURE_PAGES_KEY, value: parsed.data as unknown as Json, updated_by: ctx.user.id, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw mapDbError(error);
  await audit({
    tenantId: null,
    actorUserId: ctx.user.id,
    actorType: "platform",
    action: "platform_setting.updated",
    entityType: "platform_setting",
    entityId: FEATURE_PAGES_KEY,
    metadata: { pages: parsed.data.pages.length },
  });
}

export async function resetFeaturePagesContent(ctx: PlatformContext): Promise<void> {
  assertPlatformPermission(ctx, "platform.settings.manage");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("platform_settings").delete().eq("key", FEATURE_PAGES_KEY);
  if (error) throw mapDbError(error);
  await audit({
    tenantId: null,
    actorUserId: ctx.user.id,
    actorType: "platform",
    action: "platform_setting.updated",
    entityType: "platform_setting",
    entityId: FEATURE_PAGES_KEY,
    metadata: { reset: true },
  });
}

export function revalidateFeaturePages() {
  revalidatePublicTags(FEATURE_PAGES_TAG);
  revalidatePath("/features");
  revalidatePath("/features/[slug]", "page");
  revalidatePath("/");
}
