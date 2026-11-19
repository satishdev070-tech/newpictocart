"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { clientIpKey, rateLimit } from "@/lib/rate-limit";
import { isSarvamLocaleCode, type SarvamLocaleCode } from "@/lib/sarvam/locales";
import { informativeOnboardingAllowed } from "@/features/informative/server/onboarding-gate";
import { normalizeInfoFacts } from "./facts";
import { runInfoTaraTurn, type InfoTaraTurnOutput } from "./turn";

const historySchema = z
  .array(z.object({ role: z.enum(["seller", "tara"]), text: z.string().max(1000) }))
  .max(40)
  .catch([]);

const inputSchema = z.object({
  locale: z.string().refine(isSarvamLocaleCode, "Choose a supported language"),
  text: z.string().trim().min(1, "Say or type something first").max(1000),
  factsJson: z.string().max(4000).default("{}"),
  historyJson: z.string().max(12_000).default("[]"),
});

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * One Tara turn on the Informative Website journey (/start/informative/basic-info). Pre-account,
 * so it is gated by the Informative rollout flag and rate-limited per client IP. The returned
 * facts only pre-fill the Step 1 form; completion re-validates everything server-side.
 */
export async function informativeTaraTurnAction(input: unknown): Promise<ActionResult<InfoTaraTurnOutput>> {
  return runAction("informative.taraTurn", async () => {
    const v = parseInput(inputSchema, input);
    if (!(await informativeOnboardingAllowed())) throw new AppError("FORBIDDEN", { fieldErrors: { _form: ["Informative websites aren't open yet."] } });
    try {
      await rateLimit("informative-tara", await clientIpKey(), 60, 3600);
    } catch (err) {
      if (err instanceof AppError && err.code === "RATE_LIMITED") throw new AppError("RATE_LIMITED", { fieldErrors: { _form: ["Let's take a short break. Please fill the form below for now."] } });
      throw err;
    }
    return runInfoTaraTurn({
      locale: v.locale as SarvamLocaleCode,
      text: v.text,
      facts: normalizeInfoFacts(parseJson(v.factsJson)),
      history: historySchema.parse(parseJson(v.historyJson) ?? []),
    });
  });
}
