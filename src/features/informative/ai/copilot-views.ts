/**
 * Informative copilot: model output schema and proposal → drawer view mapping (pure, unit tested).
 * The "before" side comes from this site's current content; a service_update for a service that
 * isn't on the site is dropped (the server matches by name, never by a model/client id).
 */
import { z } from "zod";
import { informativeLinksSchema } from "@/features/seller-ai/copilot/schemas";
import { copilotTopicSchema } from "@/features/seller-ai/copilot/scope";
import type { CopilotProposalView } from "@/features/seller-ai/copilot/types";
import { formatServicePrice, type PriceType } from "../pricing";
import { proposalSchema, proposalTitle, proposalWrites, type Proposal } from "./schemas";

const longText = (max: number) => z.string().transform((s) => s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max));

export const informativeCopilotReplySchema = z.object({
  topic: copilotTopicSchema,
  reply: longText(3000).pipe(z.string().min(1)),
  links: informativeLinksSchema,
  proposals: z
    .array(z.unknown())
    .max(4)
    .catch([])
    .default([])
    .transform((items) =>
      items.flatMap((p) => {
        const r = proposalSchema.safeParse(p);
        return r.success ? [r.data] : [];
      }),
    ),
});

export type InformativeCurrent = {
  tagline: string | null;
  about: string | null;
  seo: { title: string | null; description: string | null };
  services: { name: string; shortDescription: string | null; description: string | null; priceType?: PriceType; pricePaise?: number | null; isActive?: boolean }[];
};

/** Credits per executed action step (tara_action); copy proposals were paid for by the question. */
export type InformativeViewCosts = { action: number };

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export function informativeProposalViews(proposals: Proposal[], current: InformativeCurrent, costs: InformativeViewCosts = { action: 1 }): CopilotProposalView[] {
  const out: CopilotProposalView[] = [];
  proposals.forEach((p, i) => {
    const w = proposalWrites(p);
    const fields: CopilotProposalView["fields"] = [];
    if (w.site) {
      if (w.site.tagline) fields.push({ label: "Tagline", before: current.tagline, after: w.site.tagline });
      if (w.site.about) fields.push({ label: "About", before: current.about, after: w.site.about });
    } else if (w.seo) {
      if (w.seo.title) fields.push({ label: "Google title", before: current.seo.title, after: w.seo.title });
      if (w.seo.description) fields.push({ label: "Google description", before: current.seo.description, after: w.seo.description });
    } else if (w.services) {
      for (const s of w.services) {
        const price = formatServicePrice(s.priceType, s.pricePaise) ?? "Price on request";
        fields.push({ label: `New service: ${s.name}`, before: null, after: [`${price}`, s.shortDescription, s.description].filter(Boolean).join("\n") });
      }
    } else if (w.faqs) {
      w.faqs.forEach((f, n) => fields.push({ label: `FAQ ${n + 1}`, before: null, after: `${f.question}\n${f.answer}` }));
    } else if (w.serviceUpdate) {
      const svc = current.services.find((s) => norm(s.name) === norm(w.serviceUpdate!.serviceName));
      if (!svc) return;
      if (w.serviceUpdate.shortDescription) fields.push({ label: "Short description", before: svc.shortDescription, after: w.serviceUpdate.shortDescription });
      if (w.serviceUpdate.description) fields.push({ label: "Description", before: svc.description, after: w.serviceUpdate.description });
    } else if (w.servicePrice) {
      const svc = current.services.find((s) => norm(s.name) === norm(w.servicePrice!.serviceName));
      if (!svc) return;
      const before = svc.priceType ? (formatServicePrice(svc.priceType, svc.pricePaise) ?? "Hidden") : null;
      const after = formatServicePrice(w.servicePrice.priceType, w.servicePrice.pricePaise) ?? "Hidden";
      if (before === after) return;
      fields.push({ label: "Price", before, after });
    } else if (w.serviceVisibility) {
      const svc = current.services.find((s) => norm(s.name) === norm(w.serviceVisibility!.serviceName));
      if (!svc || svc.isActive === w.serviceVisibility.visible) return;
      fields.push({ label: "On your website", before: svc.isActive === false ? "Hidden" : "Shown", after: w.serviceVisibility.visible ? "Shown" : "Hidden" });
    }
    if (!fields.length) return;
    const action = p.kind === "service_price" || p.kind === "service_visibility";
    out.push({ id: `${p.kind}-${i}`, title: proposalTitle(p), fields, applyCredits: action ? costs.action : 0, payload: { proposal: p } });
  });
  return out;
}
