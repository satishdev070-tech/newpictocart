/** AI credit kinds for the Informative Website (migration 8600 seeds their costs). */
export const INFORMATIVE_AI_CREDIT_KINDS = ["informative_assistant", "informative_site_build"] as const;
export type InformativeAiCreditKind = (typeof INFORMATIVE_AI_CREDIT_KINDS)[number];

export const INFORMATIVE_AI_KIND_LABELS: Record<InformativeAiCreditKind, string> = {
  informative_assistant: "Website assistant",
  informative_site_build: "Build my website with AI",
};
