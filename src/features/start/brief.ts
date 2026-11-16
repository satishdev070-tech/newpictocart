import { formatMoney } from "@/lib/money";
import type { StartDraft } from "./draft/schema";
import {
  draftCategories,
  draftCategory,
  draftProductsServices,
  draftSubcategories,
  draftSeedSubcategory,
  draftSiteMode,
  draftStoreName,
} from "./draft/schema";
import { subcategoryLabel } from "@/features/stores/subcategories";
import { collectSelectionLabels } from "@/features/onboarding/seed/fallback";
import { START_INTENTS } from "./intents";
import { subcategoryDisplayLabel } from "./draft/apply-facts";

/** Rich text brief for seedReadyStore curation. */
export function buildSeedBrief(draft: StartDraft): string {
  const lines: string[] = [];
  const name = draftStoreName(draft);
  if (name) lines.push(`Store name: ${name}`);
  const tagline = draft.business.tagline.trim() || draft.voice.facts.tagline?.trim();
  if (tagline) lines.push(`Tagline: ${tagline}`);
  const cat = draftCategory(draft);
  const cats = draftCategories(draft);
  if (cat) lines.push(`Industry/category: ${cat}`);
  if (cats.length > 1) lines.push(`Categories: ${cats.join(", ")}`);
  const sub = draftSeedSubcategory(draft);
  const niche = draftProductsServices(draft) || null;
  const multi = draftSubcategories(draft);
  if ((draft.business.subcategories?.length ?? 0) > 0 || (draft.voice.facts.subcategories?.length ?? 0) > 0) {
    const labels = multi.map((s) => subcategoryDisplayLabel(cats, s));
    const free = niche && !niche.toLowerCase().startsWith("sub:") ? [niche] : [];
    const all = [...labels, ...free].filter((l, i, arr) => arr.findIndex((x) => x.toLowerCase() === l.toLowerCase()) === i);
    if (all.length > 0) lines.push(`Product types: ${all.join(", ")}`);
  } else if (cat && (sub || niche)) {
    const labels = collectSelectionLabels(cat, sub, niche);
    if (labels.length > 0) lines.push(`Product types: ${labels.join(", ")}`);
  } else if (sub) {
    const label = cat ? subcategoryLabel(cat, sub) : null;
    lines.push(`Subcategory: ${label ?? sub}`);
  }
  if (niche && !niche.toLowerCase().startsWith("sub:")) {
    lines.push(`Products / services: ${niche}`);
  }
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
  if (vf.name || vf.category || vf.subcategory || vf.productsServices) {
    lines.push("Voice session facts:");
    if (vf.name) lines.push(`- name: ${vf.name}`);
    if (vf.categories?.length) lines.push(`- categories: ${vf.categories.join(", ")}`);
    else if (vf.category) lines.push(`- category: ${vf.category}`);
    if (vf.subcategories?.length) lines.push(`- product types: ${vf.subcategories.join(", ")}`);
    else if (vf.subcategory) lines.push(`- subcategory: ${vf.subcategory}`);
    if (vf.productsServices) lines.push(`- products/services: ${vf.productsServices}`);
    if (vf.siteMode) lines.push(`- site mode: ${vf.siteMode}`);
    if (vf.tagline) lines.push(`- tagline: ${vf.tagline}`);
    if (vf.city) lines.push(`- city: ${vf.city}`);
  }
  return lines.join("\n");
}
