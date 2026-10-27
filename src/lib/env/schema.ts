import { z } from "zod";
import { EnvValidationError, HOSTNAME_MESSAGE, HOSTNAME_PATTERN, normalizeRootDomain } from "./public-parse";

export { EnvValidationError };

/**
 * Environment contracts. Pure module (no `server-only`) so it can be unit tested.
 * Server code reads values through `@/lib/env/server`; browser code through
 * `@/lib/env/public`. Never add a secret to `publicEnvSchema`.
 */

const hostnameLike = z
  .string()
  .trim()
  .toLowerCase()
  .regex(HOSTNAME_PATTERN, HOSTNAME_MESSAGE);

/**
 * The platform root domain. Accepts the usual paste mistakes (`https://www.example.in/`) and
 * reduces them to the bare apex: scheme, path/trailing slash and a leading `www.` are dropped
 * (`www.{root}` is always the platform, never the root itself). Ports and anything else that is
 * not a hostname are still rejected.
 */
const rootDomain = z
  .string()
  .trim()
  .toLowerCase()
  .transform(normalizeRootDomain)
  .pipe(hostnameLike);

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  /** Supabase publishable (formerly "anon") key. Safe for the browser; RLS protects data. */
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  /** Root domain that hosts the platform, e.g. `pictocart.in`. Stores live at `{slug}.{root}`. */
  NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN: rootDomain,
  /**
   * Full origin (scheme + host, no path) of the platform app, e.g. https://pictocart.in. Used for
   * links in emails and OAuth callbacks (defaults from the root domain). Its host is also served
   * as the platform, so it may differ from the root domain (e.g. https://saas-ecom-puce.vercel.app).
   */
  NEXT_PUBLIC_PLATFORM_URL: z.url().optional(),
});

export const serverEnvSchema = publicEnvSchema.extend({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** Supabase secret (formerly "service_role") key. Server-only, bypasses RLS. */
  SUPABASE_SECRET_KEY: z.string().min(20),
  /**
   * Shared secret between the Cloudflare domain-router Worker and this app.
   * Used to verify the signed forwarded-host header. Optional until the Worker is deployed;
   * when unset, the app trusts only the literal Host header.
   */
  EDGE_SHARED_SECRET: z.string().min(32).optional(),
  /**
   * Extra exact hostnames that serve the platform app (comma-separated, bare hostnames), e.g. a
   * Vercel production alias. Read by the proxy through lib/platform/hosts; validated here.
   */
  PLATFORM_HOST_ALIASES: z
    .string()
    .optional()
    .refine((v) => !v || v.split(",").every((h) => hostnameLike.safeParse(h).success), "must be comma-separated bare hostnames such as saas-ecom-puce.vercel.app"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  /**
   * 32+ random chars. Root secret for HMAC-signed cart/session tokens and for encrypting
   * per-tenant payment credentials (keys are derived per purpose with HKDF; see lib/crypto.ts).
   */
  APP_SECRET: z.string().min(32),
  /** Bearer token required by /api/cron/* endpoints (Vercel Cron / Cloudflare Cron Triggers). */
  CRON_SECRET: z.string().min(24).optional(),
  /** Transactional email (Resend). When unset, emails are logged instead of sent. */
  RESEND_API_KEY: z.string().min(10).optional(),
  /**
   * Supabase Auth "Send Email" hook secret (Authentication → Hooks), format `v1,whsec_<base64>`.
   * When set, /api/auth/email-hook sends every auth email (confirm, reset, magic link, invite,
   * email change) through Resend with platform/store branding instead of Supabase's mailer.
   */
  SEND_EMAIL_HOOK_SECRET: z
    .string()
    .regex(/^v1,whsec_[A-Za-z0-9+/=]{16,}$/, "must look like v1,whsec_… (copy it from Supabase → Authentication → Hooks)")
    .optional(),
  VERCEL_TOKEN: z.string().min(10).optional(),
  VERCEL_PROJECT_ID: z.string().min(3).optional(),
  VERCEL_TEAM_ID: z.string().min(3).optional(),
  EMAIL_FROM: z.string().min(3).default("Pictocart <no-reply@example.com>"),
  /** Cloudflare for SaaS custom hostnames (Phase 11). Optional until custom domains go live. */
  CLOUDFLARE_API_TOKEN: z.string().min(20).optional(),
  CLOUDFLARE_ZONE_ID: z.string().min(10).optional(),
  /** CNAME target customers point custom domains at, e.g. stores.pictocart.in */
  CUSTOM_DOMAIN_CNAME_TARGET: hostnameLike.optional(),
  /**
   * Platform OAuth apps for the social hub (sellers connect their own accounts through them).
   * A network shows "Not configured" until both of its values are set.
   */
  META_APP_ID: z.string().min(5).optional(),
  META_APP_SECRET: z.string().min(10).optional(),
  META_GRAPH_VERSION: z.string().regex(/^v\d{2}\.0$/).default("v25.0"),
  PINTEREST_APP_ID: z.string().min(3).optional(),
  PINTEREST_APP_SECRET: z.string().min(10).optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(10).optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(10).optional(),
  /**
   * Fallbacks only: the super admin normally enters these in Admin → Social apps (stored
   * encrypted in platform_app_credentials, which wins over env).
   */
  META_WEBHOOK_VERIFY_TOKEN: z.string().min(16).max(200).optional(),
  GEMINI_API_KEY: z.string().min(10).optional(),
  GROQ_API_KEY: z.string().min(10).optional(),
  ANTHROPIC_API_KEY: z.string().min(10).optional(),
  /** Unsplash Access Key fallback; Admin → Media library stores one in the console (wins over env). */
  UNSPLASH_ACCESS_KEY: z.string().trim().optional(),
  /**
   * Sarvam AI API subscription key (speech, chat, TTS, translate). SERVER ONLY.
   * Optional until voice onboarding is enabled; when unset, Sarvam helpers throw
   * a validation AppError (`sarvam_not_configured`).
   */
  SARVAM_API_KEY: z.string().min(10).optional(),
  /**
   * Optional Upstash Redis REST credentials for storefront L2 cache (ADR-010).
   * Both must be set together; when either is blank the storefront stays on Next Data Cache only.
   */
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(10).optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;


export function parseEnv<S extends z.ZodType>(schema: S, source: Record<string, string | undefined>): z.infer<S> {
  // Treat empty strings as unset so `.optional()` behaves as expected with blank .env lines.
  const cleaned = Object.fromEntries(Object.entries(source).map(([k, v]) => [k, v === "" ? undefined : v]));
  const result = schema.safeParse(cleaned);
  if (!result.success) {
    // Report variable names and reasons only, never values.
    throw new EnvValidationError(result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`));
  }
  return result.data;
}
