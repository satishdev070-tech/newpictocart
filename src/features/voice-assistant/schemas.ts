/**
 * Voice assistant input / model-output schemas (pure, unit tested). Inputs are strict. Model output
 * is lenient on text and strict on anything that can change data: a theme patch is only kept when
 * it is a valid allowlisted token + #RRGGBB colour.
 */
import { z } from "zod";
import { ASSISTANT_LOCALES } from "./languages";

export const ASSISTANT_MAX_INPUT = 600;

export const assistantTurnSchema = z.object({
  /** Resume an existing conversation (must be the member's own, checked by RLS + query). */
  sessionId: z.uuid().optional(),
  text: z.string().trim().min(1, "Say or type something first").max(ASSISTANT_MAX_INPUT),
  locale: z.enum(ASSISTANT_LOCALES),
  inputMode: z.enum(["voice", "text"]).default("text"),
  /** Dashboard path the merchant is on (context only, never used for authorization). */
  page: z
    .string()
    .max(200)
    .regex(/^\/[\w\-/[\]]*$/)
    .optional()
    .catch(undefined),
});
export type AssistantTurnInput = z.infer<typeof assistantTurnSchema>;

export const assistantActionInputSchema = z.object({ actionId: z.uuid() });

export const assistantSessionInputSchema = z.object({ sessionId: z.uuid() });

/** Theme tokens the assistant may change (allowlist). */
export const THEME_COLOR_TOKENS = ["primary", "accent", "background", "text"] as const;
export type ThemeColorToken = (typeof THEME_COLOR_TOKENS)[number];

const HEX = /^#[0-9a-fA-F]{6}$/;

const themePatchSchema = z.object({
  token: z.enum(THEME_COLOR_TOKENS),
  color: z
    .string()
    .trim()
    .regex(HEX)
    .transform((c) => c.toLowerCase()),
});

export const ASSISTANT_INTENTS = ["answer", "clarify", "theme_color", "unsupported"] as const;

export const assistantModelReplySchema = z.object({
  reply: z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim().slice(0, 600))
    .pipe(z.string().min(1)),
  intent: z.enum(ASSISTANT_INTENTS).catch("answer"),
  /** Only for intent "theme_color"; dropped when invalid. */
  themePatch: themePatchSchema.nullable().optional().catch(null),
});
export type AssistantModelReply = z.infer<typeof assistantModelReplySchema>;

export type AssistantActionView = {
  id: string;
  tool: "propose_theme_patch";
  status: "proposed" | "applied" | "undone" | "rejected" | "failed";
  title: string;
  token: ThemeColorToken;
  before: string | null;
  after: string;
};

export type AssistantTurnResult = {
  sessionId: string;
  locale: "en-IN" | "hi-IN" | "hinglish";
  reply: string;
  action: AssistantActionView | null;
};
