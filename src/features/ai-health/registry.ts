/**
 * Registry of THIS app's AI features (pure, safe for client and server). Every Neural Pulse
 * GenerationKind is listed, plus the site-builder section writer, the AI theme builder and the
 * Sarvam-only onboarding flows. `routable` features run through `loadProviders(feature)`, so a row
 * in ai_feature_routes changes the provider/model they actually use.
 */
import type { AiProvider, GenerationKind } from "@/features/neural-pulse/schemas";

export type AiEngine = "llm" | "llm_sarvam" | "sarvam";

export type AiFeature = {
  key: string;
  label: string;
  description: string;
  /** Where a seller or admin triggers it. */
  usedIn: string;
  /** Call site in the code, for whoever debugs it. */
  source: string;
  engine: AiEngine;
  /** True when ai_feature_routes applies (Gemini / Groq / Anthropic through loadProviders). */
  routable: boolean;
  /** Credit kind debited per use (ai_credit_action_costs.kind), or null when free. */
  creditKind: string | null;
};

type NeuralPulseFeature = AiFeature & { key: GenerationKind };

const NEURAL_PULSE: NeuralPulseFeature[] = [
  { key: "caption", label: "Social caption", description: "Instagram, Facebook and X captions with hashtags for a product or idea.", usedIn: "Dashboard → Marketing → Neural Pulse (Captions)", source: "features/neural-pulse/actions.ts (generateCaptionAction)", engine: "llm", routable: true, creditKind: "caption" },
  { key: "hashtags", label: "Hashtags", description: "Reserved kind. Hashtags currently come back inside captions and content plans; nothing calls it on its own yet.", usedIn: "Not called separately yet", source: "features/neural-pulse/schemas.ts (GenerationKind)", engine: "llm", routable: true, creditKind: "hashtags" },
  { key: "ideas", label: "Post ideas", description: "5–12 post ideas with hook, format, pillar and channels.", usedIn: "Dashboard → Marketing → Neural Pulse (Ideas)", source: "features/neural-pulse/actions.ts (generateIdeasAction)", engine: "llm", routable: true, creditKind: "ideas" },
  { key: "plan", label: "Content plan", description: "A dated multi-week posting plan with captions, saved as social post drafts.", usedIn: "Dashboard → Marketing → Neural Pulse (Planner)", source: "features/neural-pulse/actions.ts (generatePlanAction)", engine: "llm", routable: true, creditKind: "plan" },
  { key: "review_reply", label: "Review reply", description: "Draft public reply to a Google Business Profile or store review.", usedIn: "Dashboard → Google Business reviews", source: "features/neural-pulse/server/index.ts (suggestReviewReply)", engine: "llm", routable: true, creditKind: "review_reply" },
  { key: "message_reply", label: "Message reply", description: "Draft reply (not sent) to the latest messages of a social inbox conversation.", usedIn: "Dashboard → Inbox", source: "features/neural-pulse/server/index.ts (suggestMessageReply)", engine: "llm", routable: true, creditKind: "message_reply" },
  { key: "profile", label: "Brand profile", description: "Brand voice, audience and keywords draft, and the Google Business Profile description.", usedIn: "Neural Pulse (Brand) and Google Business profile", source: "features/neural-pulse/actions.ts (autofillBrandAction), server/index.ts (generateProfileDescription)", engine: "llm", routable: true, creditKind: "profile" },
  { key: "section", label: "Site builder section", description: "“Add with AI” writes one section's settings from a short prompt. Sarvam chat is the fallback, and the only model when no LLM key is set.", usedIn: "Dashboard → Theme (site builder)", source: "features/theme/site-builder/ai-actions.ts (generateSectionAction)", engine: "llm_sarvam", routable: true, creditKind: "section" },
];

export const AI_FEATURES: readonly AiFeature[] = [
  ...NEURAL_PULSE,
  { key: "theme_builder", label: "AI theme builder", description: "Builds a marketplace theme from a reference site and screenshots (vision models go first when images are attached).", usedIn: "Admin → Themes → New theme", source: "features/theme/builder/server/generate.ts (generateThemeForAdmin)", engine: "llm", routable: true, creditKind: null },
  {
    key: "generate_product",
    label: "Product generate with AI",
    description: "Fills title, description, attributes, SEO and a price hint from product image(s) via the generate-product edge function.",
    usedIn: "Dashboard → Products → editor (Generate with AI)",
    source: "features/catalog/actions.ts (generateProductFromImageAction)",
    engine: "llm",
    routable: false,
    creditKind: "generate_product",
  },
  { key: "onboarding_seed", label: "Store starter content", description: "Categories, products, hero, SEO, blogs and testimonials for a new store. A deterministic plan is used when Sarvam is missing or fails.", usedIn: "Seller onboarding (ready store)", source: "features/onboarding/seed/generate.ts (generateReadyStorePlan)", engine: "sarvam", routable: false, creditKind: "onboarding_seed" },
  { key: "voice_onboarding", label: "Voice onboarding (Tara)", description: "Speech-to-text, chat and text-to-speech in Indian languages to set a store up by voice.", usedIn: "Seller onboarding (voice method)", source: "features/onboarding/voice/turn.ts (runTaraTurn)", engine: "sarvam", routable: false, creditKind: null },
];

export const ROUTABLE_FEATURE_KEYS = AI_FEATURES.filter((f) => f.routable).map((f) => f.key);

export function findFeature(key: string): AiFeature | undefined {
  return AI_FEATURES.find((f) => f.key === key);
}

export const ENGINE_LABELS: Record<AiEngine, string> = { llm: "Gemini / Groq / Anthropic", llm_sarvam: "LLM, then Sarvam", sarvam: "Sarvam only" };

export type FeatureRoute = {
  featureKey: string;
  primaryProvider: AiProvider;
  primaryModel: string | null;
  fallbackProvider: AiProvider | null;
  fallbackModel: string | null;
  enabled: boolean;
};
