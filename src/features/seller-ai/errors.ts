/**
 * Seller-facing AI failure copy (pure). Never includes API keys or provider response bodies.
 * Keep in sync with neural-pulse FAILED_MESSAGE for the generic case.
 */

export const SELLER_AI_FAILED_MESSAGE = "The AI service didn't return a usable answer. Please try again in a minute.";

export function friendlySellerAiFailure(failures: { provider: string; error: string }[]): string {
  const errors = failures.map((f) => f.error.toLowerCase());
  if (errors.length && errors.every((e) => /\b403\b|unauthorized|forbidden|invalid.?api.?key/.test(e))) {
    return "An AI API key was rejected. A platform admin should check Admin → Social apps (and AI Health routes), then try again.";
  }
  if (errors.some((e) => /\b503\b|timeout|network error/.test(e))) {
    return "The AI service is busy or timed out. Please try again in a minute.";
  }
  if (errors.some((e) => /\b404\b/.test(e))) {
    return "The configured AI model isn't available. A platform admin should check Admin → AI Health, then try again.";
  }
  return SELLER_AI_FAILED_MESSAGE;
}
