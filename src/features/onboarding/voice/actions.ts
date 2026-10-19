"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/observability/logger";
import { isSarvamConfigured, chatTurn, synthesizeSpeech, transcribeAudio } from "@/lib/sarvam/client";
import { isSarvamLocaleCode, type SarvamLocaleCode } from "@/lib/sarvam/locales";
import { assertEmailVerifiedForOnboarding } from "../email-gate";
import {
  EMPTY_FACTS,
  factsComplete,
  mapCategoryToIndustry,
  mapSiteMode,
  mergeFacts,
  type VoiceFacts,
} from "./facts";
import { taraSystemPrompt, taraUserPrompt } from "./prompt";
import { taraTurnResultSchema, voiceTurnInputSchema } from "./schemas";

export type VoiceTurnData = {
  transcript: string;
  reply: string;
  facts: VoiceFacts;
  done: boolean;
  audioBase64: string | null;
  audioMimeType: string | null;
  ttsAvailable: boolean;
};

function parseFactsJson(raw: unknown): VoiceFacts {
  if (typeof raw !== "string" || !raw.trim()) return { ...EMPTY_FACTS };
  try {
    const parsed = JSON.parse(raw) as Partial<VoiceFacts>;
    return mergeFacts(EMPTY_FACTS, {
      name: typeof parsed.name === "string" ? parsed.name : null,
      category: mapCategoryToIndustry(typeof parsed.category === "string" ? parsed.category : null),
      siteMode: mapSiteMode(typeof parsed.siteMode === "string" ? parsed.siteMode : null),
      tagline: typeof parsed.tagline === "string" ? parsed.tagline : null,
      city: typeof parsed.city === "string" ? parsed.city : null,
    });
  } catch {
    return { ...EMPTY_FACTS };
  }
}

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

/**
 * One Tara voice/text turn: STT (optional) → chat → TTS (when Bulbul supports the locale).
 * Pre-store: rate-limited by user id (AI credits apply after tenant create / seed).
 */
export async function voiceTurnAction(_prev: ActionResult<VoiceTurnData> | null, fd: FormData): Promise<ActionResult<VoiceTurnData>> {
  return runAction("onboarding.voiceTurn", async () => {
    const user = await requireUser("/onboarding");
    await assertEmailVerifiedForOnboarding();
    await rateLimit("onboarding-voice", user.id, 30, 3600);

    if (!isSarvamConfigured()) {
      throw new AppError("VALIDATION", {
        fieldErrors: { _form: ["Voice isn't set up on this platform yet. Use the form option instead."] },
        context: { reason: "sarvam_not_configured" },
      });
    }

    const raw = formToObject(fd);
    const input = parseInput(voiceTurnInputSchema, raw);
    const locale = input.locale as SarvamLocaleCode;
    const facts = parseFactsJson(input.factsJson);

    let transcript = (input.text ?? "").trim();
    const audio = raw.audio;
    if ((!transcript || transcript.length < 1) && audio instanceof File && audio.size > 0) {
      if (audio.size > 3_000_000) {
        throw new AppError("VALIDATION", { fieldErrors: { audio: ["Keep each recording under 30 seconds."] } });
      }
      const stt = await transcribeAudio({ audio, languageCode: locale, filename: audio.name || "turn.webm" });
      transcript = stt.transcript;
    }
    if (!transcript) {
      throw new AppError("VALIDATION", { fieldErrors: { _form: ["Say something or type a short answer."] } });
    }

    const turn = await chatTurn({
      messages: [
        { role: "system", content: taraSystemPrompt(locale) },
        { role: "user", content: taraUserPrompt({ transcript, facts, locale }) },
      ],
      responseFormat: "json",
      temperature: 0.35,
      languageCode: locale,
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

    const speech = await synthesizeSpeech({ text: reply, languageCode: locale });

    return {
      transcript,
      reply,
      facts: nextFacts,
      done,
      audioBase64: speech?.audioBase64 ?? null,
      audioMimeType: speech?.mimeType ?? null,
      ttsAvailable: Boolean(speech),
    };
  });
}

const localeSchema = z.object({
  locale: z.string().refine(isSarvamLocaleCode, "Choose a language from the list"),
});

/** Persist onboarding language on the auth user (survives email confirm / devices). */
export async function saveOnboardingLocaleAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult<{ locale: string }>> {
  return runAction("onboarding.locale", async () => {
    const user = await requireUser("/onboarding");
    await assertEmailVerifiedForOnboarding();
    const input = parseInput(localeSchema, formToObject(fd));
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ data: { onboarding_locale: input.locale } });
    if (error) logger.warn("onboarding.locale_failed", { userId: user.id, code: error.code });
    return { locale: input.locale };
  });
}

const methodSchema = z.object({
  method: z.enum(["voice", "form"]),
  locale: z.string().refine(isSarvamLocaleCode).optional(),
});

export async function saveOnboardingMethodAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult<{ method: "voice" | "form" }>> {
  return runAction("onboarding.method", async () => {
    await requireUser("/onboarding");
    await assertEmailVerifiedForOnboarding();
    const input = parseInput(methodSchema, formToObject(fd));
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({
      data: {
        onboarding_method: input.method,
        ...(input.locale ? { onboarding_locale: input.locale } : {}),
      },
    });
    if (error) logger.warn("onboarding.method_failed", { code: error.code });
    return { method: input.method };
  });
}

/** Resend the signup confirmation email (existing confirm flow). */
export async function resendOnboardingConfirmAction(_prev: ActionResult | null, _fd: FormData): Promise<ActionResult<{ sent: boolean }>> {
  return runAction("onboarding.resendConfirm", async () => {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!email) throw new AppError("UNAUTHENTICATED");
    await rateLimit("onboarding-resend-confirm", email, 3, 3600);
    const { platformOrigin } = await import("@/lib/platform/urls");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${platformOrigin()}/auth/callback?next=${encodeURIComponent("/onboarding")}` },
    });
    if (error) logger.warn("onboarding.resend_confirm_failed", { code: error.code });
    return { sent: true };
  });
}
