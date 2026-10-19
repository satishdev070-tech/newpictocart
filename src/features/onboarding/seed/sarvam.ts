import "server-only";
import { AppError } from "@/lib/errors";

/**
 * Thin adapter over `@/lib/sarvam/client` for the seed pipeline.
 * Matches the foundation workstream's exports (`chatTurn`, `translateText`) and
 * supplies seed-friendly defaults (JSON chat, English-IN when locale omitted).
 */

export type SarvamChatMessage = { role: "system" | "user" | "assistant"; content: string };

type SarvamClient = {
  chatTurn: (args: { messages: SarvamChatMessage[]; languageCode: string; temperature?: number }) => Promise<string>;
  translateText: (args: { text: string; source: string; target: string }) => Promise<string>;
};

const SETUP = "Sarvam AI isn't available yet. Finish the Sarvam foundation setup, then try again.";

async function loadClient(): Promise<SarvamClient> {
  try {
    const mod = (await import("@/lib/sarvam/client")) as Partial<SarvamClient> & Record<string, unknown>;
    if (typeof mod.chatTurn !== "function" || typeof mod.translateText !== "function") {
      throw new Error("missing exports");
    }
    return { chatTurn: mod.chatTurn.bind(mod), translateText: mod.translateText.bind(mod) };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("VALIDATION", { fieldErrors: { _form: [SETUP] }, context: { reason: "sarvam_client_missing" } });
  }
}

/** Seed chat turn → raw assistant text (JSON plan). */
export async function chatTurn(input: {
  messages: SarvamChatMessage[];
  languageCode?: string;
  temperature?: number;
}): Promise<{ content: string }> {
  const client = await loadClient();
  const content = await client.chatTurn({
    messages: input.messages,
    languageCode: input.languageCode ?? "en-IN",
    temperature: input.temperature ?? 0.4,
  });
  return { content };
}

export async function translateText(input: {
  text: string;
  targetLanguageCode: string;
  sourceLanguageCode?: string;
}): Promise<{ translatedText: string }> {
  const client = await loadClient();
  const translatedText = await client.translateText({
    text: input.text,
    source: input.sourceLanguageCode ?? "en-IN",
    target: input.targetLanguageCode,
  });
  return { translatedText };
}
