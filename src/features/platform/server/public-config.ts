import "server-only";
import type { Metadata } from "next";
import { cache } from "react";
import { revalidatePath } from "next/cache";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { publicEnv } from "@/lib/env/public";
import { logger } from "@/lib/observability/logger";
import { PLATFORM_ICON } from "@/config/platform";
import { cachedPublic, revalidatePublicTags } from "@/lib/cache/public-cache";
import { LANDING_KEY } from "@/features/marketing-site/landing";
import { DEFAULT_PUBLIC_CONFIG, brandImageUrl, parsePublicConfig, type BrandImage, type PublicPlatformConfig } from "../public-config";

export const PUBLIC_CONFIG_TAG = "platform-public-config";

class PublicConfigUnavailable extends Error {}

async function load(): Promise<PublicPlatformConfig> {
  // Anon client + RLS (platform_settings_public_select): only `public.*` keys are visible.
  const { data, error } = await createSupabasePublicClient().from("platform_settings").select("key, value").like("key", "public.%").neq("key", LANDING_KEY).limit(100);
  if (error) {
    logger.warn("platform.public_config_unavailable", { code: error.code });
    throw new PublicConfigUnavailable(); // not cached; defaults are used below
  }
  return parsePublicConfig(data ?? []);
}

const cached = cachedPublic("platform-public-config", load, {
  tags: [PUBLIC_CONFIG_TAG],
  revalidateSeconds: 300,
  keyPrefix: "pub:v1",
});

/** Logos, favicon, GA4 id and switches. Never throws: any failure means today's defaults. */
export const getPublicPlatformConfig = cache(async (): Promise<PublicPlatformConfig> => {
  try {
    return await cached();
  } catch {
    return DEFAULT_PUBLIC_CONFIG;
  }
});

export type BrandImageView = { src: string; width: number | null; height: number | null };

export function brandImageView(image: BrandImage | null): BrandImageView | null {
  if (!image) return null;
  try {
    return { src: brandImageUrl(publicEnv().NEXT_PUBLIC_SUPABASE_URL, image), width: image.width, height: image.height };
  } catch {
    return null; // env not available (e.g. a build without env): fall back to the wordmark
  }
}

/** After any public.* change: refresh the cached config and every page that renders it. */
export function revalidatePublicConfig() {
  revalidatePublicTags(PUBLIC_CONFIG_TAG);
  revalidatePath("/", "layout");
}

/** Absolute URL of the uploaded social share image, or null (the generated /og image is used). */
export async function shareImageUrl(): Promise<string | null> {
  return brandImageView((await getPublicPlatformConfig()).ogImage)?.src ?? null;
}

/** Favicon metadata for platform pages (marketing, seller auth, onboarding). */
export async function platformIconMetadata(): Promise<Metadata> {
  const favicon = brandImageView((await getPublicPlatformConfig()).favicon);
  // Fallback: the Pictocart mark shipped in /public (app/favicon.ico also covers /favicon.ico).
  return { icons: favicon ? { icon: favicon.src, apple: favicon.src } : { icon: PLATFORM_ICON, apple: PLATFORM_ICON } };
}
