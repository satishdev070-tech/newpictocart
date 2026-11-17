import "server-only";
import { AppError } from "@/lib/errors";
import { getSarvamLocale } from "@/lib/sarvam/locales";
import { runSellerAiGeneration } from "@/features/seller-ai/server";
import { formatServicePrice } from "../pricing";
import type { PageSection } from "../sections";
import type { InformativeContext } from "../server/context";
import { getPage, getSite, listFaqs, listGallery, listServices, listTeam, listTestimonials } from "../server/repo";
import { generateSectionPrompt, rewriteSectionPrompt, type EditorBrief } from "./prompts";
import { applyRewrite, collectTextFields, generatedSectionSchema, rewriteOutputSchema, toNewSection, type GenerateSectionInput, type GeneratedSection, type RewriteSectionInput } from "./schemas";

/**
 * Website editor AI. Tenant and permissions come from InformativeContext (the member's own
 * membership); the page is read through the panel repo (tenant-scoped, RLS), so a page id from
 * another tenant is simply not found. Provider routing with multi-provider fallback, the daily
 * limit, the informative_assistant credit debit, refunds on failure and the generation log all
 * come from runSellerAiGeneration. Nothing is saved here: the editor gets the section back and
 * the seller saves the page.
 */

/** Separate daily bucket from the chat assistant, so editing doesn't eat the chat's allowance. */
const EDITOR_LIMIT = { key: "informative-editor-ai", perDay: 60, message: "You've used today's AI section writing for your website. Try again tomorrow." };

const pageGone = () => new AppError("NOT_FOUND", { fieldErrors: { _form: ["This page doesn't exist any more. Reload the editor and try again."] } });

/** English name of a non-English language (e.g. "Hindi"); null for English / unknown. */
function languageFor(locale: string | null | undefined): string | null {
  const l = locale ? getSarvamLocale(locale) : undefined;
  return l && l.code !== "en-IN" ? l.englishName : null;
}

async function loadEditorBrief(ctx: InformativeContext, pageId: string, locale?: string | null): Promise<{ brief: EditorBrief; sections: PageSection[] }> {
  const [page, site, services, faqs, team, testimonials, gallery] = await Promise.all([
    getPage(ctx, pageId),
    getSite(ctx),
    listServices(ctx),
    listFaqs(ctx),
    listTeam(ctx),
    listTestimonials(ctx),
    listGallery(ctx),
  ]);
  if (!page) throw pageGone();
  if (!site) throw new AppError("NOT_FOUND", { fieldErrors: { _form: ["Set up your website first."] } });
  const active = services.filter((s) => s.isActive);
  const priced = active.map((s) => formatServicePrice(s.priceType, s.pricePaise)).filter((p) => p && p !== "Price on request");
  return {
    sections: page.sections,
    brief: {
      businessName: site.businessName,
      serviceType: site.serviceType,
      category: site.category,
      city: site.contact.city,
      tagline: site.tagline,
      about: site.about,
      services: active.slice(0, 20).map((s) => ({ name: s.name, priceText: formatServicePrice(s.priceType, s.pricePaise) })),
      faqs: faqs.slice(0, 20).map((f) => f.question),
      extra: null,
      language: languageFor(locale),
      page: { title: page.title, type: page.type, sectionTypes: page.sections.map((s) => s.type) },
      counts: { services: active.length, pricedServices: priced.length, faqs: faqs.length, team: team.length, testimonials: testimonials.length, gallery: gallery.length },
    },
  };
}

/** "Add with AI": one new section for the page (not saved; placed after the page's last section). */
export async function generateSection(ctx: InformativeContext, input: GenerateSectionInput): Promise<{ section: PageSection }> {
  const { brief, sections } = await loadEditorBrief(ctx, input.pageId, input.locale);
  const r = await runSellerAiGeneration({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    feature: "informative_assistant",
    creditKind: "informative_assistant",
    input: { op: "editor.generate_section", pageId: input.pageId, type: input.type ?? null, instruction: input.instruction.slice(0, 200) },
    prompt: generateSectionPrompt(brief, { type: input.type, instruction: input.instruction }),
    schema: generatedSectionSchema(input.type),
    limit: EDITOR_LIMIT,
  });
  const generated: GeneratedSection = { type: r.data.type, props: r.data.props };
  return { section: toNewSection(generated, sections) };
}

/** "Rewrite with AI": the same section with new wording for its text fields only. */
export async function rewriteSection(ctx: InformativeContext, input: RewriteSectionInput): Promise<{ section: PageSection }> {
  const fields = collectTextFields(input.section.props);
  // Checked before any credit is spent.
  if (!fields.length) throw new AppError("VALIDATION", { fieldErrors: { _form: ["This section has no text of its own to rewrite yet. Add a heading or some text first."] } });
  const { brief } = await loadEditorBrief(ctx, input.pageId, input.locale);
  const r = await runSellerAiGeneration({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    feature: "informative_assistant",
    creditKind: "informative_assistant",
    input: { op: "editor.rewrite_section", pageId: input.pageId, type: input.section.type, fields: fields.length, instruction: input.instruction?.slice(0, 200) ?? null },
    prompt: rewriteSectionPrompt(brief, { type: input.section.type, fields, instruction: input.instruction }),
    schema: rewriteOutputSchema,
    limit: EDITOR_LIMIT,
  });
  return { section: applyRewrite(input.section, fields, r.data.fields) };
}
