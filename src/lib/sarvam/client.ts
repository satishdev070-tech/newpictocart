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
    logger.warn("sarvam.stt_failed", { language: args.languageCode, error: safeErrorMessage(err) });
    throw new AppError("VALIDATION", { fieldErrors: { _form: ["Couldn't hear that clearly. Try again or type your answer."] } });
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
    logger.warn("sarvam.chat_failed", { language: sellerLocale, error: safeErrorMessage(err) });
    throw new AppError("VALIDATION", {
      fieldErrors: { _form: ["Tara couldn't reply just now. Please try again or type your answer."] },
      context: { reason: "sarvam_chat_failed" },
    });
  }
}

/** Bulbul TTS → base64 audio, or null when the locale has no TTS. */
export async function synthesizeSpeech(args: {
  text: string;
  languageCode: SarvamLocaleCode;
}): Promise<{ audioBase64: string; mimeType: string } | null> {
  const ttsLang = ttsLocaleFor(args.languageCode);
  if (!ttsLang) return null;
  const client = requireClient();
  const text = args.text.slice(0, 2400);
  if (!text.trim()) return null;
  try {
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
    logger.warn("sarvam.tts_failed", { language: args.languageCode, error: safeErrorMessage(err) });
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
      source,
      target,
      model,
      error: safeErrorMessage(err),
    });
    return { translatedText: text };
  }
}
