import "server-only";
import { AppError } from "@/lib/errors";
import {
  chatTurn as sarvamChatTurn,
  translateText as sarvamTranslateText,
  type ChatTurnResult,
  type TranslateTextResult,
} from "@/lib/sarvam/client";
import { normalizeSarvamLocale } from "@/lib/sarvam/locales";

/**
 * Thin adapter over `@/lib/sarvam/client` for the seed pipeline.
 */

export type SarvamChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** Seed chat turn → assistant text (JSON plan). */
export async function chatTurn(input: {
  messages: SarvamChatMessage[];
  responseFormat?: "json" | "text";
  temperature?: number;
  model?: string;
  languageCode?: string;
}): Promise<ChatTurnResult> {
  try {
    const languageCode = input.languageCode ? normalizeSarvamLocale(input.languageCode) ?? undefined : undefined;
    return await sarvamChatTurn({
      messages: input.messages,
      responseFormat: input.responseFormat ?? "json",
      temperature: input.temperature ?? 0.4,
      model: input.model,
      languageCode,
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("VALIDATION", {
      fieldErrors: { _form: ["Sarvam AI isn't available yet. Finish the Sarvam foundation setup, then try again."] },
      context: { reason: "sarvam_client_missing" },
    });
  }
}

export async function translateText(input: {
  text: string;
  targetLanguageCode: string;
  sourceLanguageCode?: string;
}): Promise<TranslateTextResult> {
  try {
    return await sarvamTranslateText(input);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("VALIDATION", {
      fieldErrors: { _form: ["Sarvam AI isn't available yet. Finish the Sarvam foundation setup, then try again."] },
      context: { reason: "sarvam_client_missing" },
    });
  }
}
