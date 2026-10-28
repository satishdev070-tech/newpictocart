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
  /** True when ai_feature_routes applies (NVIDIA / Gemini / Groq / Anthropic through loadProviders). */
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
  { key: "generate_product", label: "Product from image", description: "Vision model fills title, description, tags and suggested price from a product photo (or hint).", usedIn: "Dashboard → Products → Add / edit (Generate with AI)", source: "features/seller-ai/actions.ts (generateProductFromImageAction) (in-process generateJson)", engine: "llm", routable: true, creditKind: "generate_product" },
  { key: "generate_blog", label: "Blog AI Write", description: "Drafts a blog title, excerpt, tags, SEO and content blocks from a short topic.", usedIn: "Dashboard → Content → Blog", source: "features/seller-ai/actions.ts (generateBlogAction) (in-process generateJson)", engine: "llm", routable: true, creditKind: "generate_blog" },
  { key: "contact_reply", label: "Contact reply draft", description: "Drafts a polite email reply to a store contact-form message (not sent).", usedIn: "Dashboard → Content → Messages", source: "features/seller-ai/actions.ts (generateContactReplyAction) (in-process generateJson)", engine: "llm", routable: true, creditKind: "contact_reply" },
  { key: "business_coach", label: "Business coach", description: "Checklist of next steps from the store's real metrics, top sellers, low stock and pending setup, in the seller's panel language (English or Hindi).", usedIn: "Dashboard home", source: "features/seller-ai/actions.ts (refreshBusinessCoachAction) (in-process generateJson)", engine: "llm", routable: true, creditKind: "business_coach" },
  { key: "store_agent", label: "Pica2 AI Assistant", description: "Answers the seller's questions from their own orders, products, stock and sales, with growth tips and links to dashboard pages. Replies in the panel language.", usedIn: "Dashboard (floating “Pica2 AI Assistant” button)", source: "features/seller-ai/actions.ts (askStoreAgentAction)", engine: "llm", routable: true, creditKind: "store_agent" },
  { key: "store_setup", label: "Store setup from a prompt", description: "Turns a shop description and product names (optionally photos) into categories and draft products, and can apply the best-fit marketplace theme as a draft.", usedIn: "Dashboard home (Set up your store from a prompt)", source: "features/seller-ai/actions.ts (setupStoreFromPromptAction)", engine: "llm", routable: true, creditKind: "store_setup" },
  { key: "theme_builder", label: "AI theme builder", description: "Builds a marketplace theme from a reference site and screenshots (vision models go first when images are attached).", usedIn: "Admin → Themes → New theme", source: "features/theme/builder/server/generate.ts (generateThemeForAdmin)", engine: "llm", routable: true, creditKind: null },
  { key: "onboarding_seed", label: "Store starter content", description: "Categories, products, hero, SEO, blogs and testimonials for a new store. A deterministic plan is used when Sarvam is missing or fails.", usedIn: "Seller onboarding (ready store)", source: "features/onboarding/seed/generate.ts (generateReadyStorePlan)", engine: "sarvam", routable: false, creditKind: "onboarding_seed" },
  { key: "voice_onboarding", label: "Voice onboarding (Tara)", description: "Speech-to-text, chat and text-to-speech in Indian languages to set a store up by voice.", usedIn: "Seller onboarding (voice method)", source: "features/onboarding/voice/turn.ts (runTaraTurn)", engine: "sarvam", routable: false, creditKind: null },
];

export const ROUTABLE_FEATURE_KEYS = AI_FEATURES.filter((f) => f.routable).map((f) => f.key);

/**
 * Seller AI features seeded to NVIDIA (Nemotron Omni text default) when no Admin → AI Health
 * route row exists yet. Vision still swaps to NVIDIA_VISION_MODEL inside nvidiaRequestBody.
 */
export const SELLER_AI_NVIDIA_DEFAULT_ROUTE_KEYS = [
  "generate_product",
  "generate_blog",
  "store_agent",
  "contact_reply",
  "business_coach",
] as const;

export function findFeature(key: string): AiFeature | undefined {
  return AI_FEATURES.find((f) => f.key === key);
}

export const ENGINE_LABELS: Record<AiEngine, string> = { llm: "NVIDIA / Gemini / Groq / Anthropic", llm_sarvam: "LLM, then Sarvam", sarvam: "Sarvam only" };

export type FeatureRoute = {
  featureKey: string;
  primaryProvider: AiProvider;
  primaryModel: string | null;
  fallbackProvider: AiProvider | null;
  fallbackModel: string | null;
  enabled: boolean;
};
