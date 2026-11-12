import "server-only";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";
import { runSellerAiGeneration } from "@/features/seller-ai/server";
import { formatServicePrice } from "../pricing";
import type { ServiceInput } from "../schemas";
import type { InformativeContext } from "../server/context";
import {
  createFaq,
  createService,
  getSite,
  listFaqs,
  listServices,
  softDeleteContent,
  updateSeo,
  updateService,
  updateSiteCopy,
} from "../server/repo";
import { assistantPrompt, siteBuildPrompt, type SiteBrief } from "./prompts";
import { assistantReplySchema, proposalWrites, siteBuildSchema, toServiceWrite, type AssistantChatInput, type AssistantReply, type Proposal, type ServiceWrite, type SiteBuild } from "./schemas";

/**
 * Informative Website AI (M9). Tenant and permissions come from InformativeContext (the member's
 * own membership); every write goes through the panel repo, which re-checks permissions, and RLS.
 * Provider calls, credits, refunds and logs reuse runSellerAiGeneration (seller-ai/server.ts).
 */

const ASSISTANT_LIMIT = { key: "informative-assistant", perDay: 40, message: "You've reached today's limit for the website assistant. Try again tomorrow." };
const BUILD_LIMIT = { key: "informative-site-build", perDay: 4, message: "You've rebuilt your website with AI several times today. Try again tomorrow." };

export async function loadSiteBrief(ctx: InformativeContext, extra?: string | null): Promise<SiteBrief> {
  const [site, services, faqs] = await Promise.all([getSite(ctx), listServices(ctx), listFaqs(ctx)]);
  if (!site) throw new AppError("NOT_FOUND", { context: { op: "informative.ai.brief" } });
  return {
    businessName: site.businessName,
    serviceType: site.serviceType,
    category: site.category,
    city: site.contact.city,
    tagline: site.tagline,
    about: site.about,
    services: services.filter((s) => s.isActive).slice(0, 20).map((s) => ({ name: s.name, priceText: formatServicePrice(s.priceType, s.pricePaise) })),
    faqs: faqs.slice(0, 20).map((f) => f.question),
    extra: extra ?? null,
  };
}

function newService(w: ServiceWrite): ServiceInput {
  return { ...w, isFeatured: false, isActive: true } as ServiceInput;
}

/** One assistant turn: reply + proposals. Debits informative_assistant credits. */
export async function askAssistant(ctx: InformativeContext, input: AssistantChatInput): Promise<AssistantReply> {
  const brief = await loadSiteBrief(ctx);
  const r = await runSellerAiGeneration({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    feature: "informative_assistant",
    creditKind: "informative_assistant",
    input: { turns: input.messages.length, last: input.messages[input.messages.length - 1]?.content.slice(0, 200) ?? null },
    prompt: assistantPrompt(brief, input),
    schema: assistantReplySchema,
    limit: ASSISTANT_LIMIT,
  });
  return { reply: r.data.reply, proposals: r.data.proposals };
}

/** Applies one proposal the owner approved. Returns what changed, for the confirmation. */
export async function applyProposal(ctx: InformativeContext, proposal: Proposal): Promise<{ changed: string }> {
  const w = proposalWrites(proposal);
  if (w.site) {
    await updateSiteCopy(ctx, w.site);
    return { changed: "site" };
  }
  if (w.seo) {
    const site = await getSite(ctx);
    await updateSeo(ctx, { title: w.seo.title ?? undefined, description: w.seo.description ?? undefined, ogImagePath: site?.seo.ogImagePath ?? undefined } as Parameters<typeof updateSeo>[1]);
    return { changed: "seo" };
  }
  if (w.services) {
    for (const s of w.services) await createService(ctx, newService(s));
    return { changed: `${w.services.length} services` };
  }
  if (w.faqs) {
    for (const f of w.faqs) await createFaq(ctx, { ...f, isVisible: true });
    return { changed: `${w.faqs.length} FAQs` };
  }
  return { changed: "nothing" };
}

/**
 * Writes a whole-site build: tagline and About, better descriptions for the current services
 * (matched by name; prices the seller set are kept), new services up to 6, the FAQs and SEO.
 * `replaceFaqs` swaps the onboarding starter FAQs for the AI's.
 */
export async function applySiteBuild(ctx: InformativeContext, build: SiteBuild, opts: { replaceFaqs: boolean }): Promise<void> {
  await updateSiteCopy(ctx, { tagline: build.tagline || undefined, about: build.about });
  const services = await listServices(ctx);
  const byName = new Map(services.map((s) => [s.name.trim().toLowerCase(), s]));
  let added = 0;
  for (const ai of build.services) {
    const current = byName.get(ai.name.trim().toLowerCase());
    if (current) {
      await updateService(ctx, current.id, {
        name: current.name,
        slug: current.slug,
        shortDescription: ai.shortDescription || current.shortDescription || undefined,
        description: ai.description || current.description || undefined,
        imagePath: current.imagePath ?? undefined,
        priceType: current.priceType,
        pricePaise: current.pricePaise ?? undefined,
        durationMinutes: current.durationMinutes ?? ai.durationMinutes ?? undefined,
        category: current.category ?? undefined,
        isFeatured: current.isFeatured,
        isActive: current.isActive,
        seoTitle: current.seo.title ?? undefined,
        seoDescription: current.seo.description ?? undefined,
      } as ServiceInput);
    } else if (services.length + added < 6) {
      await createService(ctx, newService(toServiceWrite(ai)));
      added++;
    }
  }
  if (build.faqs.length) {
    if (opts.replaceFaqs) for (const f of await listFaqs(ctx)) await softDeleteContent(ctx, "faqs", f.id);
    for (const f of build.faqs) await createFaq(ctx, { question: f.question, answer: f.answer, isVisible: true });
  }
  if (build.seoTitle || build.seoDescription) {
    const site = await getSite(ctx);
    await updateSeo(ctx, { title: build.seoTitle || undefined, description: build.seoDescription || undefined, ogImagePath: site?.seo.ogImagePath ?? undefined } as Parameters<typeof updateSeo>[1]);
  }
}

/**
 * Generates and writes a whole-site build. `free` (right after onboarding) skips the credit debit;
 * the daily limit still applies. Returns false when AI isn't available, so callers keep the
 * ready-made starter content instead of failing.
 */
export async function buildSiteWithAi(ctx: InformativeContext, opts: { free: boolean; notes?: string | null }): Promise<{ built: boolean; reason?: string }> {
  const brief = await loadSiteBrief(ctx, opts.notes);
  let build: SiteBuild;
  try {
    const r = await runSellerAiGeneration({
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      feature: "informative_site_build",
      creditKind: "informative_site_build",
      input: { serviceType: brief.serviceType, services: brief.services.length, free: opts.free },
      prompt: siteBuildPrompt(brief),
      schema: siteBuildSchema,
      limit: BUILD_LIMIT,
      debit: !opts.free,
    });
    build = r.data;
  } catch (err) {
    const reason = err instanceof AppError ? (err.context?.reason as string | undefined) ?? err.code : "error";
    logger.warn("informative.ai_build_skipped", { tenantId: ctx.tenantId, reason });
    if (opts.free) return { built: false, reason };
    throw err;
  }
  await applySiteBuild(ctx, build, { replaceFaqs: opts.free });
  logger.info("informative.ai_build_done", { tenantId: ctx.tenantId, free: opts.free, services: build.services.length, faqs: build.faqs.length });
  return { built: true };
}
