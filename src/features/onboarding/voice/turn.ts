import "server-only";
import { logger } from "@/lib/observability/logger";
import { chatTurn, synthesizeSpeech, transcribeAudio, isSarvamConfigured } from "@/lib/sarvam/client";
import type { SarvamLocaleCode } from "@/lib/sarvam/locales";
import { AppError } from "@/lib/errors";
import {
  EMPTY_FACTS,
  factsComplete,
  mapCategoryToIndustry,
  mapSiteMode,
  mergeFacts,
  type VoiceFacts,
} from "./facts";
import { taraSystemPrompt, taraUserPrompt } from "./prompt";
import { taraTurnResultSchema } from "./schemas";

export type TaraTurnOutput = {
  transcript: string;
  reply: string;
  facts: VoiceFacts;
  done: boolean;
  audioBase64: string | null;
  audioMimeType: string | null;
  ttsAvailable: boolean;
};

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {
        /* fall through */
      }
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
  }
  return null;
}

export type RunTaraTurnInput = {
  locale: SarvamLocaleCode;
  facts: VoiceFacts;
  text?: string;
  audio?: File | null;
};

/** STT → chat → TTS for one Tara turn (server-only). */
export async function runTaraTurn(input: RunTaraTurnInput): Promise<TaraTurnOutput> {
  if (!isSarvamConfigured()) {
    throw new AppError("VALIDATION", {
      fieldErrors: { _form: ["Voice isn't set up on this platform yet. Use the form option instead."] },
      context: { reason: "sarvam_not_configured" },
    });
  }

  const facts = input.facts ?? { ...EMPTY_FACTS };
  let transcript = (input.text ?? "").trim();
  const audio = input.audio;
  if ((!transcript || transcript.length < 1) && audio instanceof File && audio.size > 0) {
    if (audio.size > 3_000_000) {
      throw new AppError("VALIDATION", { fieldErrors: { audio: ["Keep each recording under 30 seconds."] } });
    }
    const stt = await transcribeAudio({ audio, languageCode: input.locale, filename: audio.name || "turn.webm" });
    transcript = stt.transcript;
  }
  if (!transcript) {
    throw new AppError("VALIDATION", { fieldErrors: { _form: ["Say something or type a short answer."] } });
  }

  const turn = await chatTurn({
    messages: [
      { role: "system", content: taraSystemPrompt(input.locale) },
      { role: "user", content: taraUserPrompt({ transcript, facts, locale: input.locale }) },
    ],
    responseFormat: "json",
    temperature: 0.35,
    languageCode: input.locale,
  });

  const parsedRaw = extractJsonObject(turn.content);
  const parsed = taraTurnResultSchema.safeParse(parsedRaw);
  let reply: string;
  let nextFacts = facts;
  let done = false;

  if (parsed.success) {
    reply = parsed.data.reply;
    nextFacts = mergeFacts(facts, {
      name: parsed.data.facts.name ?? null,
      category: mapCategoryToIndustry(parsed.data.facts.category ?? null),
      siteMode: mapSiteMode(parsed.data.facts.siteMode ?? null),
      tagline: parsed.data.facts.tagline ?? null,
      city: parsed.data.facts.city ?? null,
    });
    done = parsed.data.done || factsComplete(nextFacts);
  } else {
    logger.warn("onboarding.voice_parse_failed", { preview: turn.content.slice(0, 200) });
    reply = turn.content.slice(0, 500);
    done = factsComplete(nextFacts);
  }

  const speech = await synthesizeSpeech({ text: reply, languageCode: input.locale });

  return {
    transcript,
    reply,
    facts: nextFacts,
    done,
    audioBase64: speech?.audioBase64 ?? null,
    audioMimeType: speech?.mimeType ?? null,
    ttsAvailable: Boolean(speech),
  };
}
