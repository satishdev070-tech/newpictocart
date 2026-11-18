import "server-only";
import { logger } from "@/lib/observability/logger";
import { AppError } from "@/lib/errors";
import { chatTurn, isSarvamConfigured } from "@/lib/sarvam/client";
import type { SarvamLocaleCode } from "@/lib/sarvam/locales";
import { loadProviders } from "@/features/neural-pulse/server/generate";
import { generateJson, type ProviderConfig } from "@/features/neural-pulse/server/llm";
import { taraSystemPrompt, taraUserPrompt } from "./prompt";
import { taraTurnResultSchema } from "./schemas";
import type { VoiceFacts } from "./facts";

/**
 * Tara's "brain" for one onboarding turn. Order: Sarvam chat (Indian languages) → the platform
 * LLMs from Admin → AI health (route `tara_onboarding`; fast models first) → throws, and the
 * caller falls back to the scripted slot-filling questions. Before this, Tara went straight to
 * scripted questions whenever Sarvam was down or out of credits, which is why she sounded robotic.
 *
 * Returns the raw JSON text so the caller keeps one parsing path.
 */
export type TaraBrainInput = {
  locale: SarvamLocaleCode;
  transcript: string;
  facts: VoiceFacts;
  history?: { role: "seller" | "tara"; text: string }[];
};

/** Fast, cheap models first for a live voice turn (latency matters more than depth here). */
export function orderForVoice(providers: ProviderConfig[]): ProviderConfig[] {
  const rank: Record<string, number> = { groq: 0, gemini: 1, anthropic: 2, nvidia: 3 };
  return [...providers].sort((a, b) => (rank[a.id] ?? 9) - (rank[b.id] ?? 9));
}

export async function thinkAsTara(input: TaraBrainInput): Promise<{ content: string; via: string }> {
  const user = taraUserPrompt({ transcript: input.transcript, facts: input.facts, locale: input.locale, history: input.history });
  let sarvamReason: string | null = null;
  if (isSarvamConfigured()) {
    try {
      const turn = await chatTurn({
        messages: [
          { role: "system", content: taraSystemPrompt(input.locale) },
          { role: "user", content: user },
        ],
        responseFormat: "json",
        temperature: 0.35,
        languageCode: input.locale,
      });
      return { content: turn.content, via: "sarvam" };
    } catch (err) {
      sarvamReason = err instanceof AppError ? String(err.context?.reason ?? err.code) : "throw";
    }
  }

  const providers = orderForVoice(await loadProviders("tara_onboarding").catch(() => []));
  if (!providers.length) throw new AppError("INTERNAL", { context: { reason: sarvamReason ?? "no_ai_configured" } });
  try {
    // These models write every Indian language directly: no translation step.
    const r = await generateJson(providers, { system: taraSystemPrompt(input.locale, { nativeReply: true }), user }, taraTurnResultSchema);
    logger.info("onboarding.voice_llm_turn", { locale: input.locale, provider: r.provider, sarvam: sarvamReason ?? "not_configured" });
    return { content: JSON.stringify(r.data), via: r.provider };
  } catch (err) {
    throw new AppError("INTERNAL", { context: { reason: `sarvam:${sarvamReason ?? "off"}, llm:${err instanceof Error ? err.message.slice(0, 80) : "failed"}` } });
  }
}
