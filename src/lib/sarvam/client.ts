import "server-only";
import { SarvamAIClient } from "sarvamai";
import type { SarvamAI } from "sarvamai";
import { AppError } from "@/lib/errors";
import { serverEnv } from "@/lib/env/server";
import { logger } from "@/lib/observability/logger";
import {
  chatLocaleFor,
  getSarvamLocale,
  isSarvamLocaleCode,
  normalizeSarvamLocale,
  recommendedTranslateModel,
  ttsLocaleFor,
  type SarvamLocaleCode,
} from "./locales";

/** Server-only Sarvam helpers. The API key never leaves this module / logs. */

function safeErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return "unknown";
  return err.message.replace(/(?:sk_|sk-|key[_-]?|api[_-]?key[=:\s]+)[A-Za-z0-9+/=_-]{8,}/gi, "[redacted]");
}

export type SarvamErrorClass = "quota" | "auth" | "rate_limited" | "unavailable" | "bad_audio" | "unknown";

/**
 * Stable marker sent to the browser in `error.fieldErrors.reason` (AppError.context never
 * leaves the server). `["stt_unavailable", <SarvamErrorClass>]` = speech-to-text is down for a
 * provider reason (no credits, bad key, rate limit, outage): the client should switch to typing
 * / browser speech instead of asking the seller to repeat themselves.
 */
export const STT_UNAVAILABLE_REASON = "stt_unavailable";

function readStatus(err: Record<string, unknown>): number | undefined {
  for (const key of ["statusCode", "status"]) {
    const v = err[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return undefined;
}

function bodyText(body: unknown): string {
  if (body == null) return "";
  if (typeof body === "string") return body;
  try {
    return JSON.stringify(body);
  } catch {
    return "";
  }
}

/**
 * Pure classification of a Sarvam SDK / fetch failure. Duck-typed so it works on
 * `SarvamAIError` (statusCode + body), `SarvamAITimeoutError`, and raw network errors.
 */
export function classifySarvamError(err: unknown): SarvamErrorClass {
  if (!err || typeof err !== "object") return "unknown";
  const e = err as Record<string, unknown>;
  const status = readStatus(e);
  const message = typeof e.message === "string" ? e.message : "";
  const name = typeof e.name === "string" ? e.name : "";
  const text = `${bodyText(e.body)} ${message}`.toLowerCase();
  const causeCode = e.cause && typeof e.cause === "object" ? (e.cause as { code?: unknown }).code : undefined;
  const code = typeof e.code === "string" ? e.code : typeof causeCode === "string" ? causeCode : "";

  if (status === 402 || /insufficient_quota|no credits|out of credits|quota/.test(text)) return "quota";
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limited";
  if (status !== undefined && status >= 500) return "unavailable";
  if (status === 400 || status === 413 || status === 415 || status === 422) {
    return /audio|format|codec|empty|duration|file|wav|webm|mp3|mp4|ogg|silence|too (?:long|short)|corrupt/.test(text) ? "bad_audio" : "unknown";
  }
  if (status !== undefined) return "unknown";
  if (/timeout/i.test(name) || /timed? ?out|abort/.test(text) || name === "AbortError") return "unavailable";
  if (/^(?:ECONN|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|EPIPE|UND_ERR)/.test(code)) return "unavailable";
  if (/fetch failed|network|socket|econnreset|econnrefused|enotfound|eai_again/.test(text)) return "unavailable";
  return "unknown";
}

const STT_UNAVAILABLE_MESSAGE: Record<Exclude<SarvamErrorClass, "bad_audio" | "unknown">, string> = {
  quota: "Voice recognition isn't available right now — please type your answer.",
  auth: "Voice recognition isn't available right now — please type your answer.",
  rate_limited: "Voice recognition is busy right now — please type your answer or try again in a minute.",
  unavailable: "Voice recognition isn't available right now — please type your answer.",
};

export type SarvamChatRole = "system" | "user" | "assistant";
export type SarvamChatMessage = { role: SarvamChatRole; content: string };

export type ChatTurnInput = {
  messages: SarvamChatMessage[];
  /** Ask the model for a JSON object when supported. */
  responseFormat?: "json" | "text";
  temperature?: number;
  model?: string;
  /**
   * Seller onboarding locale. When set and outside the chat set, replies are produced in
   * English (or nearest chat locale) then translated back for the seller.
   */
  languageCode?: SarvamLocaleCode;
  /** Cap on generated tokens (long JSON like the seed plan truncates without it). */
  maxTokens?: number;
  /** Reasoning depth on models that support it; omitted = provider default. */
  reasoningEffort?: "low" | "high" | "max";
};

export type ChatTurnResult = {
  content: string;
  model?: string;
};

export type TranslateTextInput = {
  text: string;
  targetLanguageCode: string;
  sourceLanguageCode?: string;
};

export type TranslateTextResult = {
  translatedText: string;
};

function requireClient(): SarvamAIClient {
  const key = serverEnv().SARVAM_API_KEY;
  if (!key) {
    throw new AppError("VALIDATION", {
      fieldErrors: { _form: ["Voice setup isn't configured yet. Ask a platform admin to add the Sarvam API key."] },
      context: { reason: "sarvam_not_configured" },
    });
  }
  return new SarvamAIClient({ apiSubscriptionKey: key });
}

export function isSarvamConfigured(): boolean {
  return Boolean(serverEnv().SARVAM_API_KEY);
}

function toLocaleOrThrow(code: string, field: string): SarvamLocaleCode {
  const normalized = normalizeSarvamLocale(code);
  if (!normalized) throw new AppError("VALIDATION", { fieldErrors: { [field]: ["Unsupported language code."] } });
  return normalized;
}

/** Transcribe push-to-talk audio (≤30s) with Saaras v4. */
export async function transcribeAudio(args: {
  audio: Blob | Buffer | Uint8Array;
  languageCode: SarvamLocaleCode;
  filename?: string;
}): Promise<{ transcript: string; detectedLanguage: string | null }> {
  const client = requireClient();
  const locale = getSarvamLocale(args.languageCode);
  if (!locale?.stt) throw new AppError("VALIDATION", { fieldErrors: { language: ["That language isn't supported for speech."] } });

  const blob = args.audio instanceof Blob ? args.audio : new Blob([args.audio as BlobPart], { type: "audio/webm" });
  const filename = args.filename ?? "turn.webm";
  // File.name is a getter on the FormData file Node hands us. Assigning it throws
  // "Cannot set property name", so the filename travels beside the bytes instead.
  const contentType = blob.type || (filename.endsWith(".mp4") ? "audio/mp4" : "audio/webm");

  try {
    const res = await client.speechToText.transcribe({
      file: { data: blob, filename, contentType },
      model: "saaras:v4",
      language_code: args.languageCode,
      mode: "codemix",
    });
    return { transcript: res.transcript?.trim() ?? "", detectedLanguage: res.language_code ?? null };
  } catch (err) {
    const errorClass = classifySarvamError(err);
    logger.warn("sarvam.stt_failed", { language: args.languageCode, class: errorClass, error: safeErrorMessage(err) });
    if (errorClass === "bad_audio" || errorClass === "unknown") {
      throw new AppError("VALIDATION", {
        fieldErrors: { _form: ["Couldn't hear that clearly. Try again or type your answer."] },
        context: { reason: "stt_bad_audio", class: errorClass },
      });
    }
    throw new AppError("VALIDATION", {
      fieldErrors: { _form: [STT_UNAVAILABLE_MESSAGE[errorClass]], reason: [STT_UNAVAILABLE_REASON, errorClass] },
      context: { reason: STT_UNAVAILABLE_REASON, class: errorClass },
    });
  }
}

/** One chat turn with Sarvam-105B Conversations (seed + Tara share this). */
export async function chatTurn(input: ChatTurnInput): Promise<ChatTurnResult> {
  const client = requireClient();
  const model = (input.model ?? "sarvam-105b-conversations") as SarvamAI.SarvamModelIds;
  const sellerLocale = input.languageCode && isSarvamLocaleCode(input.languageCode) ? input.languageCode : undefined;
  const thinkIn = sellerLocale ? chatLocaleFor(sellerLocale) : "en-IN";

  try {
    const res = await client.chat.completions({
      model,
      temperature: input.temperature ?? 0.4,
      messages: input.messages as SarvamAI.ChatCompletionRequestMessage[],
      ...(input.responseFormat === "json" ? { response_format: { type: "json_object" as const } } : {}),
      ...(input.maxTokens ? { max_tokens: input.maxTokens } : {}),
      ...(input.reasoningEffort ? { reasoning_effort: input.reasoningEffort } : {}),
    });
    const raw = res.choices?.[0]?.message?.content;
    let text = typeof raw === "string" ? raw.trim() : "";
    if (!text) throw new Error("empty_chat");

    if (sellerLocale && thinkIn !== sellerLocale && getSarvamLocale(sellerLocale)?.translate) {
      const translated = await translateText({
        text,
        sourceLanguageCode: thinkIn,
        targetLanguageCode: sellerLocale,
      });
      text = translated.translatedText;
    }

    return { content: text, model: res.model ?? model };
  } catch (err) {
    if (err instanceof AppError) throw err;
    const errorClass = classifySarvamError(err);
    logger.warn("sarvam.chat_failed", { language: sellerLocale, class: errorClass, error: safeErrorMessage(err) });
    throw new AppError("VALIDATION", {
      fieldErrors: { _form: ["Tara couldn't reply just now. Please try again or type your answer."] },
      context: { reason: "sarvam_chat_failed", class: errorClass },
    });
  }
}

/**
 * Bulbul TTS → base64 audio, or null when the locale has no TTS or the provider fails
 * (no credits, outage, …). Never throws: the browser speaks the text with speechSynthesis.
 */
export async function synthesizeSpeech(args: {
  text: string;
  languageCode: SarvamLocaleCode;
}): Promise<{ audioBase64: string; mimeType: string } | null> {
  const ttsLang = ttsLocaleFor(args.languageCode);
  if (!ttsLang) return null;
  if (!isSarvamConfigured()) return null;
  const text = args.text.slice(0, 2400);
  if (!text.trim()) return null;
  try {
    const client = requireClient();
    const res = await client.textToSpeech.convert({
      text,
      language_code: ttsLang as SarvamAI.TextToSpeechLanguage,
      model: "bulbul:v3",
      speaker: "ritu",
      output_audio_codec: "mp3",
    });
    const audio = res.audios?.[0];
    if (!audio) return null;
    return { audioBase64: audio, mimeType: "audio/mpeg" };
  } catch (err) {
    logger.warn("sarvam.tts_failed", { language: args.languageCode, class: classifySarvamError(err), error: safeErrorMessage(err) });
    return null;
  }
}

/** Mayura / Sarvam-Translate short text. Accepts short codes (`hi`) or BCP-47. */
export async function translateText(input: TranslateTextInput): Promise<TranslateTextResult> {
  const client = requireClient();
  const text = input.text.slice(0, 1900);
  if (!text.trim()) return { translatedText: "" };

  const target = toLocaleOrThrow(input.targetLanguageCode, "targetLanguageCode");
  const sourceRaw = input.sourceLanguageCode?.trim() || "auto";
  const source: SarvamLocaleCode | "auto" =
    sourceRaw === "auto" ? "auto" : (normalizeSarvamLocale(sourceRaw) ?? "auto");

  const model = recommendedTranslateModel(source, target);

  try {
    const res = await client.text.translate({
      input: text,
      source_language_code: source,
      target_language_code: target,
      model,
      mode: "formal",
    });
    return { translatedText: (res.translated_text ?? text).trim() };
  } catch (err) {
    logger.warn("sarvam.translate_failed", {
      class: classifySarvamError(err),
      source,
      target,
      model,
      error: safeErrorMessage(err),
    });
    return { translatedText: text };
  }
}
