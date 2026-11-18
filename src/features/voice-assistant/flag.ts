/**
 * FEATURE_VOICE_ASSISTANT (pure parse + a process.env read; unit tested). Read on the server per
 * request, so it flips without a rebuild.
 *
 * - "off" (default; also any unknown value): the voice assistant is hidden and its actions refuse.
 * - "internal": only platform staff (active platform_memberships row) see it — staging smoke tests.
 * - "all": every store member with analytics.read.
 */
export const VOICE_ASSISTANT_FLAG_MODES = ["off", "internal", "all"] as const;
export type VoiceAssistantFlagMode = (typeof VOICE_ASSISTANT_FLAG_MODES)[number];

export function parseVoiceAssistantFlag(raw: unknown): VoiceAssistantFlagMode {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return v === "all" ? "all" : v === "internal" ? "internal" : "off";
}

export function voiceAssistantFlagMode(): VoiceAssistantFlagMode {
  return parseVoiceAssistantFlag(process.env.FEATURE_VOICE_ASSISTANT);
}

export function voiceAssistantVisible(mode: VoiceAssistantFlagMode, who: { platformStaff: boolean }): boolean {
  return mode === "all" || (mode === "internal" && who.platformStaff);
}
