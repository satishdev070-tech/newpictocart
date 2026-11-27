import { z } from "zod";

/**
 * Platform app credentials (pure helpers, no I/O). The super admin enters the platform's OAuth
 * apps (Meta, Pinterest, Google) and AI API keys in the console; env vars remain a fallback.
 * Secrets never leave the server: status objects carry only "configured", the source and a
 * masked hint.
 */

export const APP_PROVIDERS = ["meta", "pinterest", "google", "linkedin", "nvidia", "gemini", "groq", "anthropic", "resend", "unsplash", "razorpay", "cashfree", "payu", "whatsapp"] as const;
export type AppProvider = (typeof APP_PROVIDERS)[number];

export const AI_PROVIDERS = ["nvidia", "gemini", "groq", "anthropic"] as const satisfies readonly AppProvider[];
export type AiProvider = (typeof AI_PROVIDERS)[number];

/** Platform payment gateways for AI credit wallet + plan upgrades (not store checkout). */
export const PAYMENT_APP_PROVIDERS = ["razorpay", "cashfree", "payu"] as const satisfies readonly AppProvider[];
export type PaymentAppProvider = (typeof PAYMENT_APP_PROVIDERS)[number];

/**
 * OAuth + payment gateways need a client id + secret; AI providers only an API key (stored as `secret`).
 * The platform WhatsApp sender stores its phone number ID as the client id and the permanent token as the secret.
 */
export const needsClientId = (p: AppProvider) => p === "meta" || p === "pinterest" || p === "google" || p === "linkedin" || p === "razorpay" || p === "cashfree" || p === "payu" || p === "whatsapp";

/** Non-secret settings kept in `extra` (plain JSON). Anything else is dropped. Razorpay webhook secret is stored encrypted under webhookSecretCiphertext. */
export const EXTRA_KEYS: Record<AppProvider, readonly string[]> = {
  meta: ["webhookVerifyToken"],
  pinterest: [],
  google: [],
  linkedin: [],
  nvidia: ["model"],
  gemini: ["model"],
  groq: ["model"],
  anthropic: ["model"],
  resend: ["from"],
  unsplash: [],
  razorpay: ["webhookSecretCiphertext"],
  cashfree: ["environment"],
  payu: ["environment"],
  whatsapp: ["templateName", "templateLanguage"],
};

/** Non-secret `extra` values that may be shown back in the admin form (never ciphertext). */
export const PUBLIC_EXTRA_KEYS: Partial<Record<AppProvider, readonly string[]>> = {
  whatsapp: ["templateName", "templateLanguage"],
};

/** Platform WhatsApp sender (verification codes): an AUTHENTICATION template with {{1}} = code + copy-code button. */
export const WHATSAPP_OTP_DEFAULTS = { templateName: "pictocart_otp", templateLanguage: "en" } as const;

export type WhatsappOtpSender = { phoneNumberId: string; token: string; templateName: string; templateLanguage: string };

/** The sender settings from the resolved credential, with the template defaults filled in. */
export function whatsappOtpSender(cred: AppCredential | null): WhatsappOtpSender | null {
  if (!cred?.clientId || !cred.secret) return null;
  return {
    phoneNumberId: cred.clientId,
    token: cred.secret,
    templateName: cred.extra.templateName || WHATSAPP_OTP_DEFAULTS.templateName,
    templateLanguage: cred.extra.templateLanguage || WHATSAPP_OTP_DEFAULTS.templateLanguage,
  };
}

export type WhatsappOtpPayload = {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "template";
  template: {
    name: string;
    language: { code: string };
    components: [{ type: "body"; parameters: [{ type: "text"; text: string }] }, { type: "button"; sub_type: "url"; index: "0"; parameters: [{ type: "text"; text: string }] }];
  };
};

/**
 * Meta authentication-template send: the code fills the body variable {{1}} AND the copy-code
 * (OTP) button's url parameter. `to` is E.164; the Cloud API takes the digits.
 */
export function buildWhatsappOtpPayload(toE164: string, code: string, templateName: string, templateLanguage: string): WhatsappOtpPayload {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toE164.replace(/^\+/, ""),
    type: "template",
    template: {
      name: templateName,
      language: { code: templateLanguage },
      components: [
        { type: "body", parameters: [{ type: "text", text: code }] },
        { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
      ],
    },
  };
}

export type AppCredential = { clientId: string | null; secret: string; extra: Record<string, string>; source: "db" | "env" };

export type CredentialRow = { client_id: string | null; secret_ciphertext: string | null; extra: unknown } | null;

/** The env fallback for each provider (names are the documented env vars). */
export type EnvLike = Partial<Record<string, string | undefined>>;
const ENV_NAMES: Record<AppProvider, { id?: string; secret: string; extra?: Record<string, string> }> = {
  meta: { id: "META_APP_ID", secret: "META_APP_SECRET", extra: { webhookVerifyToken: "META_WEBHOOK_VERIFY_TOKEN" } },
  pinterest: { id: "PINTEREST_APP_ID", secret: "PINTEREST_APP_SECRET" },
  google: { id: "GOOGLE_OAUTH_CLIENT_ID", secret: "GOOGLE_OAUTH_CLIENT_SECRET" },
  linkedin: { id: "LINKEDIN_CLIENT_ID", secret: "LINKEDIN_CLIENT_SECRET" },
  nvidia: { secret: "NVIDIA_API_KEY" },
  gemini: { secret: "GEMINI_API_KEY" },
  groq: { secret: "GROQ_API_KEY" },
  anthropic: { secret: "ANTHROPIC_API_KEY" },
  resend: { secret: "RESEND_API_KEY", extra: { from: "EMAIL_FROM" } },
  unsplash: { secret: "UNSPLASH_ACCESS_KEY" },
  // No env fallback: platform checkout gateways are configured only in Admin → Credits economy.
  razorpay: { id: "PLATFORM_RAZORPAY_KEY_ID", secret: "PLATFORM_RAZORPAY_KEY_SECRET" },
  cashfree: { id: "PLATFORM_CASHFREE_APP_ID", secret: "PLATFORM_CASHFREE_SECRET_KEY" },
  payu: { id: "PLATFORM_PAYU_MERCHANT_KEY", secret: "PLATFORM_PAYU_MERCHANT_SALT" },
  whatsapp: { id: "PLATFORM_WHATSAPP_PHONE_NUMBER_ID", secret: "PLATFORM_WHATSAPP_ACCESS_TOKEN" },
};
export const envNamesFor = (p: AppProvider) => ENV_NAMES[p];

export function cleanExtra(provider: AppProvider, raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const k of EXTRA_KEYS[provider]) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === "string" && v) out[k] = v;
  }
  return out;
}

/**
 * DB first, env fallback. The DB row wins only when it is complete (secret, plus client id for
 * OAuth providers); otherwise the env pair is used. Non-secret `extra` merges (DB overrides env),
 * so a verify token generated in the console works with env-configured app keys too.
 * `decrypt` failures (rotated APP_SECRET, corrupt value) count as "not set" in the DB.
 */
export function resolveCredential(provider: AppProvider, row: CredentialRow, decrypt: (ciphertext: string) => string, env: EnvLike): AppCredential | null {
  const names = ENV_NAMES[provider];
  const envExtra: Record<string, string> = {};
  for (const [k, name] of Object.entries(names.extra ?? {})) if (env[name]) envExtra[k] = env[name]!;
  const extra = { ...envExtra, ...cleanExtra(provider, row?.extra) };

  let dbSecret: string | null = null;
  if (row?.secret_ciphertext) {
    try {
      dbSecret = decrypt(row.secret_ciphertext) || null;
    } catch {
      dbSecret = null;
    }
  }
  const dbId = row?.client_id || null;
  if (dbSecret && (!needsClientId(provider) || dbId)) return { clientId: needsClientId(provider) ? dbId : null, secret: dbSecret, extra, source: "db" };

  const envSecret = env[names.secret] || null;
  const envId = names.id ? env[names.id] || null : null;
  if (envSecret && (!needsClientId(provider) || envId)) return { clientId: envId, secret: envSecret, extra, source: "env" };
  return null;
}

/** "••1234" — the last 4 characters only, and only for values long enough not to reveal much. */
export function maskSecret(secret: string | null | undefined): string | null {
  if (!secret) return null;
  return secret.length >= 12 ? `••${secret.slice(-4)}` : "••••";
}

export type AppCredentialStatus = {
  provider: AppProvider;
  configured: boolean;
  source: "db" | "env" | null;
  /** Client / App id is public (it appears in every OAuth URL); shown so the admin can check it. */
  clientId: string | null;
  secretHint: string | null;
  /** A row exists in the DB but is incomplete (e.g. only the client id was saved). */
  incomplete: boolean;
  /** A row is saved in the console (it may only hold non-secret settings). */
  savedInDb: boolean;
  extraKeys: string[];
  /** Non-secret settings safe to show in the form (PUBLIC_EXTRA_KEYS only). */
  settings: Record<string, string>;
};

export function toStatus(provider: AppProvider, cred: AppCredential | null, row: CredentialRow): AppCredentialStatus {
  const incomplete = Boolean(row && (row.client_id || row.secret_ciphertext) && cred?.source !== "db");
  return {
    provider,
    configured: Boolean(cred),
    source: cred?.source ?? null,
    clientId: cred?.clientId ?? row?.client_id ?? null,
    secretHint: maskSecret(cred?.secret),
    incomplete,
    savedInDb: Boolean(row),
    extraKeys: Object.keys(cred?.extra ?? cleanExtra(provider, row?.extra)),
    settings: publicSettings(provider, cred?.extra ?? cleanExtra(provider, row?.extra)),
  };
}

function publicSettings(provider: AppProvider, extra: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of PUBLIC_EXTRA_KEYS[provider] ?? []) if (extra[k]) out[k] = extra[k];
  return out;
}

// ---- Input schemas (shared by the admin form and the server action) -----------------------

/** `Name <addr@domain>` or `addr@domain`; no quotes, commas or control characters (header-safe). */
export const FROM_RE = /^(?:[^"<>,;:@\\\u0000-\u001f]{1,80} <[^@\s<>"',;]+@[^@\s<>"',;]+\.[^@\s<>"',;]+>|[^@\s<>"',;]+@[^@\s<>"',;]+\.[^@\s<>"',;]+)$/;

const blankToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v);

export const saveAppCredentialSchema = z.object({
  provider: z.enum(APP_PROVIDERS),
  clientId: z.preprocess(blankToUndef, z.string().max(300).regex(/^[A-Za-z0-9._-]{3,300}$/, "Use the App ID / client ID exactly as shown in the developer console").optional()),
  /** Write-only: blank keeps the saved secret. */
  secret: z.preprocess(blankToUndef, z.string().min(10, "That secret looks too short").max(500).regex(/^\S+$/, "Secrets don't contain spaces").optional()),
  /** Resend only: the sender mailbox, on a domain verified in Resend. Not secret. */
  from: z.preprocess(blankToUndef, z.string().max(200).regex(FROM_RE, "Use an address on your verified domain, e.g. Pictocart <no-reply@mail.pictocart.in>").optional()),
  /** Razorpay only: write-only webhook secret (encrypted into extra). Blank keeps the saved value. */
  webhookSecret: z.preprocess(blankToUndef, z.string().min(10, "That webhook secret looks too short").max(500).regex(/^\S+$/, "Secrets don't contain spaces").optional()),
  /** Cashfree / PayU: sandbox vs production. */
  environment: z.preprocess(blankToUndef, z.enum(["test", "live"]).optional()),
  /** WhatsApp only: the approved AUTHENTICATION template's name and language code. Not secret. */
  templateName: z.preprocess(blankToUndef, z.string().max(512).regex(/^[a-z0-9_]+$/, "Use the template name exactly as in WhatsApp Manager (lowercase letters, numbers, underscores)").optional()),
  templateLanguage: z.preprocess(blankToUndef, z.string().max(10).regex(/^[a-z]{2,3}(?:_[A-Z]{2})?$/, "Use a language code such as en or en_US").optional()),
});
export type SaveAppCredentialInput = z.infer<typeof saveAppCredentialSchema>;

export const providerOnlySchema = z.object({ provider: z.enum(APP_PROVIDERS) });
