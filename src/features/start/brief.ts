import { formatMoney } from "@/lib/money";
import type { StartDraft } from "./draft/schema";
import { draftCategory, draftSiteMode, draftStoreName } from "./draft/schema";
import { START_INTENTS } from "./intents";

/** Rich text brief for seedReadyStore curation. */
export function buildSeedBrief(draft: StartDraft): string {
  const lines: string[] = [];
  const name = draftStoreName(draft);
  if (name) lines.push(`Store name: ${name}`);
  const tagline = draft.business.tagline.trim() || draft.voice.facts.tagline?.trim();
  if (tagline) lines.push(`Tagline: ${tagline}`);
  const cat = draftCategory(draft);
  if (cat) lines.push(`Industry/category: ${cat}`);
  const city = draft.business.city.trim() || draft.voice.facts.city?.trim();
  if (city) lines.push(`City: ${city}`);
  if (draft.business.whatsapp.trim()) lines.push(`WhatsApp: ${draft.business.whatsapp.trim()}`);
  lines.push(`Site mode: ${draftSiteMode(draft)}`);
  if (draft.intent) {
    const intent = START_INTENTS.find((i) => i.id === draft.intent);
    if (intent) lines.push(`Seller intent: ${intent.title} — ${intent.sub}`);
  }
  if (draft.path) lines.push(`Setup path: ${draft.path}`);
  if (draft.mood) lines.push(`Visual mood: ${draft.mood}`);
  if (draft.accent) lines.push(`Accent colour: ${draft.accent}`);
  if (draft.products.length) {
    lines.push("Seller-listed products (honour titles and approximate pricing):");
    for (const p of draft.products) {
      lines.push(`- ${p.title}: ${formatMoney(p.pricePaise)}`);
    }
  }
  const pay = draft.payment;
  if (pay.upi.trim()) lines.push(`UPI for payments: ${pay.upi.trim()}`);
  lines.push(`Cash on delivery: ${pay.cod ? "yes" : "no"}`);
  lines.push(`Shipping preference: ${pay.shipping}`);
  const vf = draft.voice.facts;
  if (vf.name || vf.category) {
    lines.push("Voice session facts:");
    if (vf.name) lines.push(`- name: ${vf.name}`);
    if (vf.category) lines.push(`- category: ${vf.category}`);
    if (vf.siteMode) lines.push(`- site mode: ${vf.siteMode}`);
    if (vf.tagline) lines.push(`- tagline: ${vf.tagline}`);
    if (vf.city) lines.push(`- city: ${vf.city}`);
  }
  return lines.join("\n");
}
