import "server-only";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { synthesizeSpeech, transcribeAudio } from "@/lib/sarvam/client";
import { parseInput } from "@/lib/validation/common";
import { sarvamCodeFor } from "./languages";
import { parseVoiceForm, speakInputSchema, type VoiceUpload } from "./schemas";

/**
 * Copilot voice (Sarvam STT / TTS) shared by both panels. Callers resolve the tenant from the
 * member's own membership and check the panel permission first; these helpers only validate,
 * rate-limit per store and call Sarvam. No AI credits are spent on voice (it's rate-limited).
 */
const STT_PER_DAY = 200;
const TTS_PER_DAY = 200;

/** Validates push-to-talk FormData (throws VALIDATION). Call before resolving the tenant. */
export function parseVoiceUpload(fd: unknown): VoiceUpload {
  if (!(fd instanceof FormData)) throw new AppError("VALIDATION", { fieldErrors: { _form: ["No recording received. Try again."] } });
  const parsed = parseVoiceForm(fd);
  if (!parsed.ok) throw new AppError("VALIDATION", { fieldErrors: { [parsed.field]: [parsed.message], _form: [parsed.message] } });
  return parsed.value;
}

export async function transcribeForCopilot(tenantId: string, upload: VoiceUpload): Promise<{ transcript: string }> {
  await limited("copilot-stt", tenantId, STT_PER_DAY, "You've used voice input a lot today. Type your question instead, or try tomorrow.");
  const r = await transcribeAudio({ audio: upload.audio, languageCode: sarvamCodeFor(upload.language), filename: upload.filename });
  if (!r.transcript) throw new AppError("VALIDATION", { fieldErrors: { _form: ["Couldn't hear that clearly. Try again or type your question."] } });
  return { transcript: r.transcript.slice(0, 2000) };
}

export async function speakForCopilot(tenantId: string, input: unknown): Promise<{ audioBase64: string; mimeType: string } | null> {
  const v = parseInput(speakInputSchema, input);
  await limited("copilot-tts", tenantId, TTS_PER_DAY, "Spoken replies are paused for today. You can still read the answers.");
  // Markdown markers read badly aloud.
  const text = v.text.replace(/\*\*|`|^#+\s*/gm, "").replace(/^\s*[-*]\s+/gm, "");
  return synthesizeSpeech({ text, languageCode: sarvamCodeFor(v.language) });
}

async function limited(bucket: string, tenantId: string, perDay: number, message: string) {
  try {
    await rateLimit(bucket, tenantId, perDay, 86_400);
  } catch (err) {
    if (err instanceof AppError && err.code === "RATE_LIMITED") throw new AppError("RATE_LIMITED", { fieldErrors: { _form: [message] } });
    throw err;
  }
}
