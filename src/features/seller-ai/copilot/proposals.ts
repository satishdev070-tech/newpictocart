/**
 * Store copilot proposals → drawer views (pure, unit tested). The model names a product by
 * title; the server maps that to an id from THIS store's catalogue (never from the model or the
 * client), and shows the current text next to the proposed text.
 */
import type { StoreApplyPayload, StoreModelProposal } from "./schemas";
import type { CopilotProposalView } from "./types";

export type CatalogueRef = { id: string; title: string };
export type ProductCopy = { description: string | null; shortDescription: string | null; seoTitle: string | null; seoDescription: string | null };

const norm = (s: string) => s.toLowerCase().replace(/["'“”‘’]/g, "").replace(/\s+/g, " ").trim();

/** Exact (case/space-insensitive) title match first, then a single unambiguous partial match. */
export function matchProductByTitle(title: string, products: CatalogueRef[]): CatalogueRef | null {
  const t = norm(title);
  if (!t) return null;
  const exact = products.filter((p) => norm(p.title) === t);
  if (exact.length === 1) return exact[0]!;
  if (exact.length > 1) return null;
  const partial = products.filter((p) => {
    const n = norm(p.title);
    return n.includes(t) || (t.length >= 4 && t.includes(n));
  });
  return partial.length === 1 ? partial[0]! : null;
}

export function storeProposalViews(
  proposals: StoreModelProposal[],
  ctx: { products: CatalogueRef[]; current: Map<string, ProductCopy>; faqApplyCredits: number },
): CopilotProposalView[] {
  const out: CopilotProposalView[] = [];
  proposals.forEach((p, i) => {
    if (p.type === "faq") {
      const payload: StoreApplyPayload = { type: "faq", groupName: p.groupName, items: p.items };
      out.push({
        id: `faq-${i}`,
        title: `Add ${p.items.length} FAQ${p.items.length === 1 ? "" : "s"} (${p.groupName})`,
        fields: p.items.map((item, n) => ({ label: `FAQ ${n + 1}`, before: null, after: `${item.question}\n${item.answer}` })),
        applyCredits: ctx.faqApplyCredits,
        payload,
      });
      return;
    }
    const product = matchProductByTitle(p.productTitle, ctx.products);
    if (!product) return;
    const before = ctx.current.get(product.id) ?? { description: null, shortDescription: null, seoTitle: null, seoDescription: null };
    const fields: CopilotProposalView["fields"] = [];
    const payload: Extract<StoreApplyPayload, { type: "product_copy" }> = { type: "product_copy", productId: product.id };
    if (p.description) {
      fields.push({ label: "Description", before: before.description, after: p.description });
      payload.description = p.description;
    }
    if (p.shortDescription) {
      fields.push({ label: "Short description", before: before.shortDescription, after: p.shortDescription });
      payload.shortDescription = p.shortDescription;
    }
    if (p.seoTitle) {
      fields.push({ label: "SEO title", before: before.seoTitle, after: p.seoTitle });
      payload.seoTitle = p.seoTitle;
    }
    if (p.seoDescription) {
      fields.push({ label: "SEO description", before: before.seoDescription, after: p.seoDescription });
      payload.seoDescription = p.seoDescription;
    }
    if (!fields.length) return;
    out.push({ id: `product-${i}`, title: `Update "${product.title}"`, fields, applyCredits: 0, payload });
  });
  return out;
}
