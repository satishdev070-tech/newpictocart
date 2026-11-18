import "server-only";
import { AppError } from "@/lib/errors";
import { accountAccessFor } from "@/lib/auth/landing";
import { voiceAssistantFlagMode, voiceAssistantVisible } from "../flag";

/** Is the voice assistant on for this signed-in user (FEATURE_VOICE_ASSISTANT)? */
export async function voiceAssistantEnabledFor(userId: string): Promise<boolean> {
  const mode = voiceAssistantFlagMode();
  if (mode === "off") return false;
  if (mode === "all") return true;
  const access = await accountAccessFor(userId).catch(() => null);
  return voiceAssistantVisible(mode, { platformStaff: access?.platformStaff ?? false });
}

export async function assertVoiceAssistantEnabled(userId: string): Promise<void> {
  if (!(await voiceAssistantEnabledFor(userId))) throw new AppError("FORBIDDEN", { fieldErrors: { _form: ["The voice assistant isn't available yet."] } });
}
