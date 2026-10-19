import type { SarvamLocaleCode } from "@/lib/sarvam/locales";
import type { StartIntentId } from "./intents";

/** Build `/seller/register` with choices collected on `/start`. */
export function buildRegisterHref(opts: {
  locale: SarvamLocaleCode;
  intent: StartIntentId;
  plan?: string | null;
  theme?: string | null;
}): string {
  const qs = new URLSearchParams();
  qs.set("lang", opts.locale);
  qs.set("intent", opts.intent);
  if (opts.plan) qs.set("plan", opts.plan);
  if (opts.theme) qs.set("theme", opts.theme);
  return `/seller/register?${qs}`;
}
