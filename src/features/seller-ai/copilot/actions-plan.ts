/**
 * Tara's store actions (stock, price, publish/unpublish/archive, blog post): model proposal →
 * resolved plan step (pure, unit tested). The model names products and variants by title; the
 * server matches them against THIS store's catalogue (tenant from membership), never against an
 * id from the model or the browser. A step the server can't resolve unambiguously becomes a
 * question for the seller instead of a guess.
 */
import { z } from "zod";
import { formatMoney } from "@/lib/money";
import type { CopilotProposalView } from "./types";

// ---- model output (lenient) ------------------------------------------------------------------

const title = z.string().trim().min(1).max(200);
const optName = z.string().trim().max(120).nullable().optional().catch(null);
/** "₹1,499" / "1499.50" / 1499 → 1499.5 (rupees). */
const rupees = z.preprocess((v) => (typeof v === "string" ? Number(v.replace(/[^\d.]/g, "")) : v), z.number().positive().max(10_000_000));
const optRupees = z.preprocess((v) => (v === "" ? null : typeof v === "string" ? Number(v.replace(/[^\d.]/g, "")) : v), z.number().positive().max(10_000_000).nullable().optional().catch(undefined));

export const stockModelSchema = z.object({
  type: z.literal("stock"),
  productTitle: title,
  variant: optName,
  mode: z.enum(["set", "add", "remove"]).catch("set").default("set"),
  quantity: z.preprocess((v) => (typeof v === "string" ? Number(v.replace(/[^\d]/g, "")) : v), z.number().int().min(0).max(100_000)),
});
export const priceModelSchema = z.object({
  type: z.literal("price"),
  productTitle: title,
  variant: optName,
  priceRupees: rupees,
  /** MRP / compare-at price shown struck through; null = remove it. */
  mrpRupees: optRupees,
});
export const statusModelSchema = z.object({
  type: z.literal("product_status"),
  productTitle: title,
  status: z.enum(["publish", "unpublish", "archive"]),
});
export const blogModelSchema = z.object({
  type: z.literal("blog_post"),
  topic: z.string().trim().min(3).max(300),
  title: z.string().trim().max(200).nullable().optional().catch(null),
  publish: z.boolean().catch(false).default(false),
});
export type StockModel = z.infer<typeof stockModelSchema>;
export type PriceModel = z.infer<typeof priceModelSchema>;
export type StatusModel = z.infer<typeof statusModelSchema>;
export type BlogModel = z.infer<typeof blogModelSchema>;
export type ActionModel = StockModel | PriceModel | StatusModel | BlogModel;

// ---- apply payloads (strict: they come back from the browser) --------------------------------

export const stockApplySchema = z.object({
  type: z.literal("stock"),
  productId: z.uuid(),
  variantId: z.uuid(),
  mode: z.enum(["set", "add", "remove"]),
  quantity: z.number().int().min(0).max(100_000),
  enableTracking: z.boolean().default(false),
});
export const priceApplySchema = z.object({
  type: z.literal("price"),
  productId: z.uuid(),
  variantIds: z.array(z.uuid()).min(1).max(50),
  pricePaise: z.number().int().positive().max(1_000_000_000),
  /** Absent = keep the current MRP; null = remove it. */
  compareAtPaise: z.number().int().positive().max(1_000_000_000).nullable().optional(),
});
export const statusApplySchema = z.object({
  type: z.literal("product_status"),
  productId: z.uuid(),
  op: z.enum(["publish", "unpublish", "archive"]),
});
export const blogApplySchema = z.object({
  type: z.literal("blog_post"),
  topic: z.string().trim().min(3).max(300),
  title: z.string().trim().max(200).optional(),
  publish: z.boolean().default(false),
});
export const actionApplySchema = z.discriminatedUnion("type", [stockApplySchema, priceApplySchema, statusApplySchema, blogApplySchema]);
export type ActionApplyPayload = z.infer<typeof actionApplySchema>;

// ---- catalogue facts the resolver needs --------------------------------------------------------

export type ProductFact = { id: string; title: string; status: string };
export type VariantFact = {
  id: string;
  productId: string;
  title: string;
  sku: string | null;
  available: number;
  tracked: boolean;
  pricePaise: number;
  compareAtPaise: number | null;
};

export type ActionFacts = {
  /** Product matched for a title the model used (null = not in this store / ambiguous). */
  product: (productTitle: string) => ProductFact | null;
  variants: (productId: string) => VariantFact[];
};

export type ActionCosts = { action: number; blog: number };

const norm = (s: string) => s.toLowerCase().replace(/["'“”‘’()]/g, "").replace(/\s+/g, " ").trim();
const isDefaultTitle = (t: string) => /^(default( title)?|default variant|-)$/i.test(t.trim()) || !t.trim();

/** Display name of a variant within its product ("Blue Kurti (M / Red)"). */
export function variantLabel(product: ProductFact, v: VariantFact | null): string {
  return v && !isDefaultTitle(v.title) ? `${product.title} (${v.title})` : product.title;
}

/**
 * Which variant the seller meant. One variant → it. A name → exact title, then one variant whose
 * options include every word of the name ("M" matches "M / Red" only if no other "M" exists).
 */
export function matchVariant(name: string | null | undefined, variants: VariantFact[]): { variant: VariantFact } | { ambiguous: VariantFact[] } | { none: true } {
  if (!variants.length) return { none: true };
  if (variants.length === 1) return { variant: variants[0]! };
  const n = norm(name ?? "");
  if (!n) return { ambiguous: variants };
  const exact = variants.filter((v) => norm(v.title) === n);
  if (exact.length === 1) return { variant: exact[0]! };
  const words = n.split(/[\s/,]+/).filter(Boolean);
  const byOptions = variants.filter((v) => {
    const opts = norm(v.title).split(/\s*\/\s*|\s*,\s*/);
    return words.every((w) => opts.includes(w) || opts.some((o) => o.split(" ").includes(w)));
  });
  if (byOptions.length === 1) return { variant: byOptions[0]! };
  return byOptions.length > 1 ? { ambiguous: byOptions } : { none: true };
}

const money = (paise: number | null) => (paise == null ? "None" : formatMoney(paise));
const stockText = (n: number) => `${n} in stock`;
const toPaise = (rupees: number) => Math.round(rupees * 100);
const STATUS_WORD: Record<string, string> = { active: "Live", draft: "Draft (hidden)", archived: "Archived" };
const OP_TARGET: Record<StatusModel["status"], string> = { publish: "active", unpublish: "draft", archive: "archived" };
const OP_VERB: Record<StatusModel["status"], string> = { publish: "Publish", unpublish: "Unpublish (hide)", archive: "Archive" };

export type ResolvedActions = { views: CopilotProposalView[]; questions: string[] };

/** Model action proposals → plan steps the seller can preview and run, plus questions to ask. */
export function resolveStoreActions(models: ActionModel[], facts: ActionFacts, costs: ActionCosts, idPrefix = "act"): ResolvedActions {
  const views: CopilotProposalView[] = [];
  const questions: string[] = [];
  models.forEach((m, i) => {
    const id = `${idPrefix}-${i}`;
    if (m.type === "blog_post") {
      const t = m.title?.trim();
      views.push({
        id,
        title: `${m.publish ? "Write and publish" : "Write"} a blog post${t ? `: "${t}"` : ""}`,
        fields: [
          { label: "Topic", before: null, after: m.topic },
          { label: "Saved as", before: null, after: m.publish ? "Published on your store" : "Draft (you can edit it before publishing)" },
        ],
        applyCredits: costs.blog,
        payload: { type: "blog_post", topic: m.topic, ...(t ? { title: t } : {}), publish: m.publish } satisfies ActionApplyPayload,
      });
      return;
    }
    const product = facts.product(m.productTitle);
    if (!product) {
      questions.push(`I couldn't find a product called "${m.productTitle}" in your store. Which product did you mean?`);
      return;
    }
    if (m.type === "product_status") {
      const target = OP_TARGET[m.status];
      if (product.status === target) {
        questions.push(`"${product.title}" is already ${STATUS_WORD[target]?.toLowerCase() ?? target}.`);
        return;
      }
      views.push({
        id,
        title: `${OP_VERB[m.status]} "${product.title}"`,
        fields: [{ label: "Status", before: STATUS_WORD[product.status] ?? product.status, after: STATUS_WORD[target] ?? target }],
        applyCredits: costs.action,
        payload: { type: "product_status", productId: product.id, op: m.status } satisfies ActionApplyPayload,
      });
      return;
    }
    const variants = facts.variants(product.id);
    if (m.type === "stock") {
      const match = matchVariant(m.variant, variants);
      if ("none" in match) {
        questions.push(variants.length ? `"${product.title}" has no option called "${m.variant}". It has: ${variants.map((v) => v.title).join(", ")}.` : `"${product.title}" has no sellable variant yet. Add a price and options first.`);
        return;
      }
      if ("ambiguous" in match) {
        questions.push(`"${product.title}" comes in ${match.ambiguous.map((v) => v.title).join(", ")}. Which one should I update, or should I set all of them?`);
        return;
      }
      const v = match.variant;
      const after = m.mode === "set" ? m.quantity : m.mode === "add" ? v.available + m.quantity : v.available - m.quantity;
      if (after < 0) {
        questions.push(`${variantLabel(product, v)} has only ${v.available} in stock, so I can't remove ${m.quantity}. Should I set it to 0?`);
        return;
      }
      if (m.mode === "set" && after === v.available && v.tracked) {
        questions.push(`${variantLabel(product, v)} already has ${v.available} in stock.`);
        return;
      }
      const fields: CopilotProposalView["fields"] = [{ label: "Stock", before: v.tracked ? stockText(v.available) : "Not tracked", after: stockText(after) }];
      if (!v.tracked) fields.push({ label: "Stock tracking", before: "Off", after: "On (sells out at 0)" });
      const verb = m.mode === "set" ? `Set stock to ${m.quantity}` : m.mode === "add" ? `Add ${m.quantity} to stock` : `Remove ${m.quantity} from stock`;
      views.push({
        id,
        title: `${verb}: ${variantLabel(product, v)}`,
        fields,
        applyCredits: costs.action,
        payload: { type: "stock", productId: product.id, variantId: v.id, mode: m.mode, quantity: m.quantity, enableTracking: !v.tracked } satisfies ActionApplyPayload,
      });
      return;
    }
    // price
    const pricePaise = toPaise(m.priceRupees);
    let targets: VariantFact[];
    const match = matchVariant(m.variant, variants);
    if ("variant" in match) targets = [match.variant];
    else if ("ambiguous" in match && !m.variant) targets = match.ambiguous; // "price of X" = every option
    else if ("ambiguous" in match) {
      questions.push(`"${product.title}" has several options matching "${m.variant}": ${match.ambiguous.map((v) => v.title).join(", ")}. Which one?`);
      return;
    } else {
      questions.push(variants.length ? `"${product.title}" has no option called "${m.variant}". It has: ${variants.map((v) => v.title).join(", ")}.` : `"${product.title}" has no variant to price yet.`);
      return;
    }
    const mrp = m.mrpRupees === undefined ? undefined : m.mrpRupees === null ? null : toPaise(m.mrpRupees);
    if (mrp != null && mrp < pricePaise) {
      questions.push(`The MRP (${money(mrp)}) can't be lower than the selling price (${money(pricePaise)}). Which is right?`);
      return;
    }
    const fields: CopilotProposalView["fields"] = [];
    let clearsMrp = false;
    for (const v of targets) {
      const label = targets.length > 1 ? `Price · ${v.title}` : "Price";
      fields.push({ label, before: money(v.pricePaise), after: money(pricePaise) });
      const keptMrp = mrp === undefined ? v.compareAtPaise : mrp;
      if (mrp !== undefined && mrp !== v.compareAtPaise) fields.push({ label: targets.length > 1 ? `MRP · ${v.title}` : "MRP (struck-through price)", before: money(v.compareAtPaise), after: money(mrp) });
      else if (keptMrp != null && keptMrp < pricePaise) clearsMrp = true;
    }
    if (clearsMrp && mrp === undefined) fields.push({ label: "MRP (struck-through price)", before: "Lower than the new price", after: "Removed (an MRP can't be below the price)" });
    if (targets.every((v) => v.pricePaise === pricePaise) && mrp === undefined) {
      questions.push(`${variantLabel(product, targets.length === 1 ? targets[0]! : null)} is already ${money(pricePaise)}.`);
      return;
    }
    views.push({
      id,
      title: `Change price to ${money(pricePaise)}: ${targets.length === 1 ? variantLabel(product, targets[0]!) : `${product.title} (all ${targets.length} options)`}`,
      fields,
      applyCredits: costs.action,
      payload: {
        type: "price",
        productId: product.id,
        variantIds: targets.map((v) => v.id),
        pricePaise,
        ...(mrp !== undefined ? { compareAtPaise: mrp } : clearsMrp ? { compareAtPaise: null } : {}),
      } satisfies ActionApplyPayload,
    });
  });
  return { views, questions };
}

/** Product titles the action proposals refer to (to load their variants in one query). */
export function actionProductTitles(models: ActionModel[]): string[] {
  return [...new Set(models.flatMap((m) => ("productTitle" in m ? [m.productTitle] : [])))];
}

/** Total credits "Do it" will spend for the open steps. */
export function planCredits(views: Pick<CopilotProposalView, "applyCredits">[]): number {
  return views.reduce((sum, v) => sum + Math.max(0, v.applyCredits), 0);
}

/**
 * The seller's reply is a plain "go ahead" (yes / haan / kar do / ok do it…) for the plan above.
 * Short and unambiguous only: anything with a "no"/"don't" or a new request goes to Tara.
 */
export function isPlanConfirmation(text: string): boolean {
  const t = text
    .toLowerCase()
    .replace(/[.!,।?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || t.length > 40) return false;
  if (/\b(no|nahi|nahin|mat|don'?t|do not|cancel|ruko|wait|stop)\b|नहीं|मत|रुको/.test(t)) return false;
  return /^(yes|yeah|yep|yup|ok|okay|sure|haan|han|ha|haa|haanji|ji|ji haan|theek hai|thik hai|done|confirm|go ahead|proceed|apply|do it|kar do|kardo|karo|kar dijiye|kijiye|हाँ|हां|जी|जी हाँ|ठीक है|कर दो|कर दीजिए|करो)( (please|pls|ji|do it|kar do|kardo|karo|go ahead|it|all|sab|sab kar do|हाँ|कर दो|कर दीजिए|जी))*$/.test(t);
}
