import "server-only";
import { AppError } from "@/lib/errors";
import { storeOrigin, storeSubdomain } from "@/lib/platform/urls";
import { getAiCreditBalance, getAiCreditCatalog } from "@/features/ai-credits/server";
import { runSellerAiGeneration } from "@/features/seller-ai/server";
import type { InformativeCopilotAsk } from "@/features/seller-ai/copilot/schemas";
import type { CopilotReply } from "@/features/seller-ai/copilot/types";
import { formatServicePrice } from "../pricing";
import type { InformativeContext } from "../server/context";
import { countEnquiriesByStatus, getSite, listFaqs, listGallery, listPages, listServices, listTeam, listTestimonials } from "../server/repo";
import { buildInformativeSnapshot } from "./copilot-snapshot";
import { informativeCopilotPrompt } from "./copilot-prompts";
import { informativeCopilotReplySchema, informativeProposalViews } from "./copilot-views";

/**
 * Informative "Ask Pictocart AI". Tenant + permissions come from InformativeContext (the member's
 * own membership); reads go through the panel repo (permission-checked, RLS). Each question
 * spends `informative_assistant` credits via runSellerAiGeneration (refund on failure).
 */

const LIMIT = { key: "informative-assistant", perDay: 40, message: "You've reached today's limit for Tara. Try again tomorrow." };
const ASK_FALLBACK = 1;

export async function informativeAskCredits(): Promise<number> {
  return (await informativeCosts()).ask;
}

/** Question/plan (informative_assistant) and each executed action step (tara_action). */
async function informativeCosts(): Promise<{ ask: number; action: number }> {
  const catalog = await getAiCreditCatalog().catch(() => null);
  const cost = (kind: string, fallback: number) => catalog?.costs.find((c) => c.kind === kind)?.credits ?? fallback;
  return { ask: cost("informative_assistant", ASK_FALLBACK), action: cost("tara_action", 1) };
}

const soft = <T>(p: Promise<T>, fallback: T) => p.catch(() => fallback);

export async function askInformativeCopilot(ctx: InformativeContext, input: InformativeCopilotAsk): Promise<CopilotReply> {
  const [site, services, faqs, pages, gallery, testimonials, team, enquiries, balance, costs] = await Promise.all([
    getSite(ctx),
    listServices(ctx),
    soft(listFaqs(ctx), []),
    soft(listPages(ctx), []),
    soft(listGallery(ctx), []),
    soft(listTestimonials(ctx), []),
    soft(listTeam(ctx), []),
    ctx.permissions.has("customers.read") ? soft(countEnquiriesByStatus(ctx), null) : Promise.resolve(null),
    soft(getAiCreditBalance(ctx.tenantId), null),
    informativeCosts(),
  ]);
  if (!site) throw new AppError("NOT_FOUND", { context: { op: "informative.copilot.site" } });
  const snapshot = buildInformativeSnapshot({
    businessName: site.businessName,
    serviceType: site.serviceType,
    category: site.category,
    status: site.status,
    siteUrl: storeOrigin(storeSubdomain(ctx.tenantSlug)),
    tagline: site.tagline,
    about: site.about,
    hasLogo: !!site.logoPath,
    hasHeroImage: !!site.heroImagePath,
    contact: { phone: site.contact.phone, whatsapp: site.contact.whatsapp, email: site.contact.email, city: site.contact.city, address: site.contact.address },
    hoursSet: site.hours.some((h) => !h.closed),
    socialLinks: Object.values(site.socialLinks).filter(Boolean).length,
    seo: { title: site.seo.title, description: site.seo.description },
    services: services.map((s) => ({ name: s.name, priceText: formatServicePrice(s.priceType, s.pricePaise), hasDescription: !!(s.description || s.shortDescription), isActive: s.isActive })),
    pages: pages.map((p) => ({ title: p.title, isPublished: p.isPublished })),
    faqs: faqs.length,
    gallery: gallery.length,
    testimonials: testimonials.length,
    team: team.length,
    enquiries: enquiries ? { new: enquiries.NEW, contacted: enquiries.CONTACTED, converted: enquiries.CONVERTED, closed: enquiries.CLOSED } : null,
    creditBalance: balance,
  });
  const r = await runSellerAiGeneration({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    feature: "informative_assistant",
    creditKind: "informative_assistant",
    input: { turns: input.messages.length, last: input.messages[input.messages.length - 1]?.content.slice(0, 200) ?? null, language: input.language, intent: input.intent ?? null, copilot: true },
    prompt: informativeCopilotPrompt({ businessName: site.businessName, language: input.language, snapshot, messages: input.messages, intent: input.intent ?? null }),
    schema: informativeCopilotReplySchema,
    limit: LIMIT,
  });
  return {
    answer: r.data.reply,
    links: r.data.links,
    proposals: informativeProposalViews(r.data.proposals, {
      tagline: site.tagline,
      about: site.about,
      seo: { title: site.seo.title, description: site.seo.description },
      services: services.map((s) => ({ name: s.name, shortDescription: s.shortDescription, description: s.description, priceType: s.priceType, pricePaise: s.pricePaise, isActive: s.isActive })),
    }, { action: costs.action }),
  };
}
