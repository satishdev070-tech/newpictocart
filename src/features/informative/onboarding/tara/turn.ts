import "server-only";
import { z } from "zod";
import { logger } from "@/lib/observability/logger";
import { AppError } from "@/lib/errors";
import { chatTurn, isSarvamConfigured, synthesizeSpeech } from "@/lib/sarvam/client";
import type { SarvamLocaleCode } from "@/lib/sarvam/locales";
import { loadProviders } from "@/features/neural-pulse/server/generate";
import { generateJson } from "@/features/neural-pulse/server/llm";
import { orderForVoice } from "@/features/onboarding/voice/brain";
import { extractJsonObject } from "@/features/onboarding/voice/json";
import { infoFactsReady, mergeInfoFacts, normalizeEmail, normalizeInfoFacts, normalizePhone, toInfoCategory, matchServiceType, type InfoVoiceFacts } from "./facts";
import { infoOfflineQuestion, nextInfoStep, wasAsked } from "./lines";
import { infoTaraSystemPrompt, infoTaraUserPrompt } from "./prompt";

export type InfoTaraHistory = { role: "seller" | "tara"; text: string }[];

export type InfoTaraTurnOutput = {
  reply: string;
  facts: InfoVoiceFacts;
  done: boolean;
  audioBase64: string | null;
  audioMimeType: string | null;
  /** Which brain answered (sarvam / groq / gemini / … / scripted). */
  via: string;
};

const modelReplySchema = z.object({
  reply: z.string().trim().min(1).max(800),
  facts: z.record(z.string(), z.unknown()).default({}),
  done: z.boolean().default(false),
});

/**
 * One Informative Tara turn (text in, text + optional Sarvam audio out). Brain: Sarvam chat →
 * platform LLMs (route `tara_onboarding`, fast first) → scripted questions with local slot filling.
 */
export async function runInfoTaraTurn(input: { locale: SarvamLocaleCode; text: string; facts: InfoVoiceFacts; history: InfoTaraHistory }): Promise<InfoTaraTurnOutput> {
  const { locale, text, history } = input;
  const facts = normalizeInfoFacts(input.facts);
  const asked = { email: wasAsked(history, "email"), services: wasAsked(history, "services") };
  const user = infoTaraUserPrompt({ transcript: text, facts, locale, history, emailAsked: asked.email, servicesAsked: asked.services });

  let parsed: z.infer<typeof modelReplySchema> | null = null;
  let via = "scripted";
  if (isSarvamConfigured()) {
    try {
      const turn = await chatTurn({
        messages: [
          { role: "system", content: infoTaraSystemPrompt(locale) },
          { role: "user", content: user },
        ],
        responseFormat: "json",
        temperature: 0.35,
        languageCode: locale,
      });
      const r = modelReplySchema.safeParse(extractJsonObject(turn.content));
      if (r.success) {
        parsed = r.data;
        via = "sarvam";
      }
    } catch (err) {
      logger.warn("informative.tara_sarvam_failed", { locale, reason: err instanceof AppError ? String(err.context?.reason ?? err.code) : "throw" });
    }
  }
  if (!parsed) {
    const providers = orderForVoice(await loadProviders("tara_onboarding").catch(() => []));
    if (providers.length) {
      try {
        const r = await generateJson(providers, { system: infoTaraSystemPrompt(locale, { nativeReply: true }), user }, modelReplySchema);
        parsed = r.data;
        via = r.provider;
      } catch (err) {
        logger.warn("informative.tara_llm_failed", { locale, message: err instanceof Error ? err.message.slice(0, 120) : "failed" });
      }
    }
  }

  let next: InfoVoiceFacts;
  let reply: string;
  if (parsed) {
    // The model returns the full facts; normalise them and back them up with the local extractor.
    next = mergeInfoFacts(facts, normalizeInfoFacts(parsed.facts));
    next = mergeInfoFacts(next, extractInfoFacts(text, facts, null));
    reply = parsed.reply;
  } else {
    // Scripted: the answer fills the question Tara asked last.
    const expecting = nextInfoStep(facts, { email: false, services: false });
    next = mergeInfoFacts(facts, extractInfoFacts(text, facts, expecting === "ready" ? null : expecting));
    const step = nextInfoStep(next, { email: asked.email || expecting === "email", services: asked.services || expecting === "services" });
    reply = infoOfflineQuestion(locale, step);
  }
  next = normalizeInfoFacts(next); // one shape for both paths (capitalised services, matched type)
  // Never "done" without the required facts, whatever the model says.
  const done = infoFactsReady(next) && ((parsed?.done ?? false) || nextInfoStep(next, { email: asked.email, services: asked.services }) === "ready");

  const speech = await synthesizeSpeech({ text: reply, languageCode: locale }).catch(() => null);
  logger.info("informative.tara_turn", { locale, via, done });
  return { reply, facts: next, done, audioBase64: speech?.audioBase64 ?? null, audioMimeType: speech?.mimeType ?? null, via };
}

/**
 * Local extractor (no AI): phone and email anywhere in the text; with `expecting`, a bare answer
 * fills that slot (e.g. "Smile Dental" when Tara asked the name). Never overwrites with junk.
 */
export function extractInfoFacts(text: string, prev: InfoVoiceFacts, expecting: string | null): Partial<InfoVoiceFacts> {
  const out: Partial<InfoVoiceFacts> = {};
  const phone = normalizePhone(text.match(/(?:\+?91[\s-]?)?[6-9](?:[\s-]?\d){9}/)?.[0] ?? null);
  if (phone) out.phone = phone;
  const email = normalizeEmail(text.match(/[^\s@]+@[^\s@]+\.[a-z]{2,}/i)?.[0] ?? null) ?? (/\bat\b.*\bdot\b/i.test(text) ? normalizeEmail(text) : null);
  if (email) out.email = email;
  const bare = text.replace(/\s+/g, " ").trim();
  switch (expecting) {
    case "businessName":
      if (bare.length >= 2 && bare.length <= 80) out.businessName = bare;
      break;
    case "serviceType": {
      const category = toInfoCategory(bare) ?? prev.category;
      const known = matchServiceType(bare, category);
      if (category || known) {
        out.category = category ?? known?.family ?? null;
        out.serviceType = known?.label ?? bare.slice(0, 60);
        out.serviceTypeId = known && (!category || known.family === category) ? known.id : null;
      }
      break;
    }
    case "city":
      if (bare.length >= 2 && bare.length <= 80 && !/\d/.test(bare)) out.city = bare;
      break;
    case "services": {
      const items = bare.split(/,|\band\b|\baur\b|और|\n/i).map((s) => s.trim()).filter((s) => s.length >= 2);
      if (items.length) out.services = items.slice(0, 6).map((name) => ({ name: name.slice(0, 120), priceRupees: null }));
      break;
    }
  }
  return out;
}
