"use server";

import { z } from "zod";
import { SITE_MODES, type SiteMode } from "@/features/stores/site-mode";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { clientIpKey, rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/observability/logger";
import { isSarvamConfigured } from "@/lib/sarvam/client";
import { parseTaraHistory, runTaraTurn } from "./turn";
import { isSarvamLocaleCode, type SarvamLocaleCode } from "@/lib/sarvam/locales";
import { assertEmailVerifiedForOnboarding } from "../email-gate";
import { parseVoiceFactsJson } from "./facts";
import { voiceTurnInputSchema } from "./schemas";
import type { TaraTurnOutput } from "./turn";
import { taraSpokenGreeting, type TaraSpokenLine } from "./greet";

/**
 * One Tara turn as the browser sees it. `transcript` / `userText` = what the seller said
 * (STT text for audio). `heard: false` = audio had no recognisable speech (show "Didn't catch that").
 */
export type VoiceTurnData = TaraTurnOutput;

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
    const facts = parseVoiceFactsJson(input.factsJson);

    const audio = raw.audio instanceof File ? raw.audio : null;
    return runTaraTurn({
      locale,
      facts,
      text: input.text,
      audio,
      history: parseTaraHistory(raw.historyJson ?? input.historyJson),
    });
  });
}

const greetingSchema = z.object({
  locale: z.string().refine(isSarvamLocaleCode, "Choose a language from the list"),
  kind: z.enum(["welcome", "resume"]).default("welcome"),
});

/**
 * Tara's spoken opener (text + Bulbul audio) for the hands-free call. Pre-account like
 * `/start`'s voice turn, so it is rate-limited by client IP; audio is cached per isolate.
 */
export async function taraGreetingAction(
  _prev: ActionResult<TaraSpokenLine> | null,
  fd: FormData,
): Promise<ActionResult<TaraSpokenLine>> {
  return runAction("onboarding.voiceGreeting", async () => {
    await rateLimit("tara-greeting", await clientIpKey(), 30, 3600);
    const input = parseInput(greetingSchema, formToObject(fd));
    return taraSpokenGreeting(input.locale as SarvamLocaleCode, input.kind);
  });
}

const localeSchema = z.object({
  locale: z.string().refine(isSarvamLocaleCode, "Choose a language from the list"),
});

/** Persist onboarding language on the auth user (survives email confirm / devices). */
export async function saveOnboardingLocaleAction(
  _prev: ActionResult<{ locale: string }> | null,
  fd: FormData,
): Promise<ActionResult<{ locale: string }>> {
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

const siteModeSchema = z.object({ siteMode: z.enum(SITE_MODES) });

/** The first onboarding question: informative website or online store (kept on the account). */
export async function saveOnboardingSiteModeAction(_prev: ActionResult<{ siteMode: SiteMode }> | null, fd: FormData): Promise<ActionResult<{ siteMode: SiteMode }>> {
  return runAction("onboarding.siteMode", async () => {
    const user = await requireUser("/onboarding");
    await assertEmailVerifiedForOnboarding();
    const input = parseInput(siteModeSchema, formToObject(fd));
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ data: { onboarding_site_mode: input.siteMode } });
    if (error) logger.warn("onboarding.site_mode_failed", { userId: user.id, code: error.code });
    return { siteMode: input.siteMode };
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
export async function resendOnboardingConfirmAction(
  _prev: ActionResult<{ sent: boolean }> | null,
  _fd: FormData,
): Promise<ActionResult<{ sent: boolean }>> {
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
