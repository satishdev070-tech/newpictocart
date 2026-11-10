import "server-only";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/observability/logger";
import { getStockImages } from "@/lib/unsplash";
import type { PlatformContext } from "@/lib/platform/access";
import { loadProviders, SETUP_MESSAGE } from "@/features/neural-pulse/server/generate";
import { LlmError, generateJson, type ProviderConfig } from "@/features/neural-pulse/server/llm";
import type { PromptImage } from "@/features/neural-pulse/prompts";
import { safeFetchText } from "../fetch-guard";
import { ThemeBuildError, buildThemeFromReference, type ThemeBuildDeps, type ThemeBuildInput, type ThemeBuildResult } from "../pipeline";

/** Per platform user: AI theme generations are slow and costly (vision + long JSON). */
export const THEME_AI_LIMITS = { perHour: 6, perDay: 30 } as const;

/** Providers that can read screenshots go first when screenshots are attached (Groq is text-only). */
export function orderForImages(providers: ProviderConfig[], hasImages: boolean): ProviderConfig[] {
  if (!hasImages) return providers;
  const vision = new Set(["anthropic", "gemini", "nvidia"]);
  return [...providers.filter((p) => vision.has(p.id)), ...providers.filter((p) => !vision.has(p.id))];
}

/** Real dependencies: guarded fetch, the platform's AI providers, Unsplash. */
export function themeBuildDeps(providers: ProviderConfig[]): ThemeBuildDeps {
  return {
    fetchText: (url, opts) => safeFetchText(url, opts),
    generate: async (prompt, schema) => {
      const ordered = orderForImages(providers, !!prompt.images?.length);
      const r = await generateJson(ordered, prompt, schema);
      return { data: r.data, provider: r.provider, model: r.model, attempts: r.attempts };
    },
    fetchStock: (category, slot, count) => getStockImages(category, slot, count),
  };
}

/** Rate-limited AI theme generation for an authorised platform user. Throws AppError. */
export async function generateThemeForAdmin(ctx: PlatformContext, input: ThemeBuildInput): Promise<ThemeBuildResult> {
  const providers = await loadProviders("theme_builder");
  if (!providers.length) throw new AppError("VALIDATION", { fieldErrors: { _form: [SETUP_MESSAGE] }, context: { reason: "ai_not_configured" } });
  try {
    await rateLimit("theme-builder-hour", ctx.user.id, THEME_AI_LIMITS.perHour, 3600);
    await rateLimit("theme-builder-day", ctx.user.id, THEME_AI_LIMITS.perDay, 86_400);
  } catch (err) {
    if (err instanceof AppError && err.code === "RATE_LIMITED") throw new AppError("RATE_LIMITED", { fieldErrors: { _form: [`You can create ${THEME_AI_LIMITS.perHour} AI themes an hour and ${THEME_AI_LIMITS.perDay} a day. Try again later.`] } });
    throw err;
  }
  const started = Date.now();
  try {
    const result = await buildThemeFromReference(input, themeBuildDeps(providers));
    logger.info("theme_builder.generated", { userId: ctx.user.id, industry: input.industry, host: result.summary?.host ?? null, screenshots: input.screenshots.length, provider: result.theme.generation?.provider, model: result.theme.generation?.model, repairs: result.theme.generation?.repairs.length, ms: Date.now() - started });
    return result;
  } catch (err) {
    if (err instanceof ThemeBuildError) throw new AppError("VALIDATION", { fieldErrors: { [err.reason === "reference" ? "url" : "_form"]: [err.message] }, context: { issues: err.issues.slice(0, 5) } });
    if (err instanceof LlmError) {
      logger.warn("theme_builder.ai_failed", { failures: err.failures });
      throw new AppError("INTERNAL", { fieldErrors: { _form: ["The AI service didn't return a usable theme. Please try again in a minute."] }, context: { failures: err.failures } });
    }
    throw err;
  }
}

const MAGIC: [PromptImage["mediaType"], (b: Uint8Array) => boolean][] = [
  ["image/png", (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47],
  ["image/jpeg", (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ["image/webp", (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50],
];

export const SCREENSHOT_LIMITS = { count: 3, bytes: 3_500_000 } as const;

/** Uploaded screenshots → base64 prompt images (type checked by magic bytes, size capped). Not stored. */
export async function screenshotsFromFiles(files: File[]): Promise<PromptImage[]> {
  const list = files.filter((f) => f.size > 0);
  if (list.length > SCREENSHOT_LIMITS.count) throw new AppError("VALIDATION", { fieldErrors: { screenshots: [`Add at most ${SCREENSHOT_LIMITS.count} screenshots.`] } });
  const out: PromptImage[] = [];
  for (const f of list) {
    if (f.size > SCREENSHOT_LIMITS.bytes) throw new AppError("VALIDATION", { fieldErrors: { screenshots: ["Each screenshot must be under 3.5 MB."] } });
    const buf = new Uint8Array(await f.arrayBuffer());
    const type = MAGIC.find(([, test]) => test(buf))?.[0];
    if (!type) throw new AppError("VALIDATION", { fieldErrors: { screenshots: ["Screenshots must be PNG, JPEG or WebP images."] } });
    out.push({ mediaType: type, data: Buffer.from(buf).toString("base64") });
  }
  return out;
}
