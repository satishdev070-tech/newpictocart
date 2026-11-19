import { describe, expect, it } from "vitest";
import {
  actionApplySchema,
  actionProductTitles,
  isPlanConfirmation,
  matchVariant,
  planCredits,
  resolveStoreActions,
  type ActionFacts,
  type ActionModel,
  type ProductFact,
  type VariantFact,
} from "@/features/seller-ai/copilot/actions-plan";
import { storeApplySchema, storeCopilotReplySchema } from "@/features/seller-ai/copilot/schemas";
import { storeCopilotPrompt } from "@/features/seller-ai/copilot/prompts";
import { informativeCopilotPrompt } from "@/features/informative/ai/copilot-prompts";
import { informativeProposalViews } from "@/features/informative/ai/copilot-views";
import { proposalSchema, proposalWrites } from "@/features/informative/ai/schemas";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const V = (n: number) => `${n}${n}${n}${n}${n}${n}${n}${n}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;

const kurti: ProductFact = { id: P1, title: "Blue Kurti", status: "active" };
const mug: ProductFact = { id: P2, title: "Clay Mug", status: "draft" };
const variant = (id: string, productId: string, title: string, available: number, extra: Partial<VariantFact> = {}): VariantFact => ({
  id,
  productId,
  title,
  sku: null,
  available,
  tracked: true,
  pricePaise: 49_900,
  compareAtPaise: null,
  ...extra,
});
const kurtiVariants = [variant(V(1), P1, "S", 4), variant(V(2), P1, "M", 12), variant(V(3), P1, "L", 0)];
const mugVariants = [variant(V(4), P2, "Default Title", 7, { tracked: false, pricePaise: 25_000, compareAtPaise: 30_000 })];

const facts: ActionFacts = {
  product: (t) => (/kurti/i.test(t) ? kurti : /mug/i.test(t) ? mug : null),
  variants: (id) => (id === P1 ? kurtiVariants : id === P2 ? mugVariants : []),
};
const costs = { action: 1, blog: 5 };
const resolve = (m: ActionModel[]) => resolveStoreActions(m, facts, costs);

describe("Tara store actions: variant matching", () => {
  it("single variant, exact title, option word; ambiguous and unknown names", () => {
    expect(matchVariant(null, mugVariants)).toEqual({ variant: mugVariants[0] });
    expect(matchVariant("m", kurtiVariants)).toEqual({ variant: kurtiVariants[1] });
    const two = [variant(V(5), P1, "M / Red", 1), variant(V(6), P1, "M / Blue", 1)];
    expect(matchVariant("red", two)).toEqual({ variant: two[0] });
    expect(matchVariant("M", two)).toEqual({ ambiguous: two });
    expect(matchVariant(null, kurtiVariants)).toEqual({ ambiguous: kurtiVariants });
    expect(matchVariant("XXL", kurtiVariants)).toEqual({ none: true });
  });
});

describe("Tara store actions: plan steps", () => {
  it("stock set / add / remove with before → after and server-resolved ids", () => {
    const r = resolve([
      { type: "stock", productTitle: "Blue Kurti", variant: "M", mode: "set", quantity: 50 },
      { type: "stock", productTitle: "blue kurti", variant: "S", mode: "add", quantity: 10 },
      { type: "stock", productTitle: "Blue Kurti", variant: "M", mode: "remove", quantity: 2 },
    ]);
    expect(r.questions).toEqual([]);
    expect(r.views.map((v) => v.title)).toEqual(["Set stock to 50: Blue Kurti (M)", "Add 10 to stock: Blue Kurti (S)", "Remove 2 from stock: Blue Kurti (M)"]);
    expect(r.views[0]!.fields[0]).toEqual({ label: "Stock", before: "12 in stock", after: "50 in stock" });
    expect(r.views[1]!.fields[0]!.after).toBe("14 in stock");
    expect(r.views[0]!.payload).toEqual({ type: "stock", productId: P1, variantId: V(2), mode: "set", quantity: 50, enableTracking: false });
    for (const v of r.views) {
      expect(v.applyCredits).toBe(1);
      expect(actionApplySchema.safeParse(v.payload).success).toBe(true);
      expect(storeApplySchema.safeParse(v.payload).success).toBe(true);
    }
  });

  it("asks instead of guessing: which size, unknown product, too few in stock", () => {
    const r = resolve([
      { type: "stock", productTitle: "Blue Kurti", variant: null, mode: "set", quantity: 5 },
      { type: "stock", productTitle: "Silk Saree", variant: null, mode: "set", quantity: 5 },
      { type: "stock", productTitle: "Blue Kurti", variant: "S", mode: "remove", quantity: 9 },
    ]);
    expect(r.views).toEqual([]);
    expect(r.questions[0]).toMatch(/S, M, L.*Which one/);
    expect(r.questions[1]).toMatch(/couldn't find a product called "Silk Saree"/);
    expect(r.questions[2]).toMatch(/only 4 in stock/);
  });

  it("untracked stock turns tracking on and says so", () => {
    const r = resolve([{ type: "stock", productTitle: "Clay Mug", variant: null, mode: "set", quantity: 20 }]);
    expect(r.views[0]!.title).toBe("Set stock to 20: Clay Mug");
    expect(r.views[0]!.fields).toContainEqual({ label: "Stock tracking", before: "Off", after: "On (sells out at 0)" });
    expect((r.views[0]!.payload as { enableTracking: boolean }).enableTracking).toBe(true);
  });

  it("price: one option, all options, MRP rules", () => {
    const one = resolve([{ type: "price", productTitle: "Blue Kurti", variant: "L", priceRupees: 599 }]).views[0]!;
    expect(one.payload).toEqual({ type: "price", productId: P1, variantIds: [V(3)], pricePaise: 59_900 });
    expect(one.fields[0]).toMatchObject({ label: "Price", after: "₹599" });
    const all = resolve([{ type: "price", productTitle: "Blue Kurti", variant: null, priceRupees: 549 }]).views[0]!;
    expect((all.payload as { variantIds: string[] }).variantIds).toEqual([V(1), V(2), V(3)]);
    expect(all.title).toMatch(/all 3 options/);
    // New price above the old MRP: the MRP is removed (DB rule) and the plan shows it.
    const mrp = resolve([{ type: "price", productTitle: "Clay Mug", variant: null, priceRupees: 350 }]).views[0]!;
    expect((mrp.payload as { compareAtPaise: null }).compareAtPaise).toBeNull();
    expect(mrp.fields.some((f) => /MRP/.test(f.label))).toBe(true);
    const bad = resolve([{ type: "price", productTitle: "Clay Mug", variant: null, priceRupees: 350, mrpRupees: 300 }]);
    expect(bad.views).toEqual([]);
    expect(bad.questions[0]).toMatch(/can't be lower/);
  });

  it("status and blog steps; no-op status becomes a note", () => {
    const r = resolve([
      { type: "product_status", productTitle: "Clay Mug", status: "publish" },
      { type: "product_status", productTitle: "Blue Kurti", status: "publish" },
      { type: "blog_post", topic: "How to style a kurti for Diwali", title: null, publish: false },
    ]);
    expect(r.views.map((v) => v.title)).toEqual(['Publish "Clay Mug"', "Write a blog post"]);
    expect(r.views[0]!.fields[0]).toEqual({ label: "Status", before: "Draft (hidden)", after: "Live" });
    expect(r.views[1]!.applyCredits).toBe(5);
    expect(r.questions[0]).toMatch(/already live/);
    expect(planCredits(r.views)).toBe(6);
    expect(actionProductTitles([{ type: "stock", productTitle: "A", variant: null, mode: "set", quantity: 1 }, { type: "blog_post", topic: "abc", title: null, publish: false }])).toEqual(["A"]);
  });

  it("the browser can't smuggle another payload shape through apply", () => {
    expect(storeApplySchema.safeParse({ type: "stock", productId: "x", variantId: V(1), mode: "set", quantity: 1 }).success).toBe(false);
    expect(storeApplySchema.safeParse({ type: "price", productId: P1, variantIds: [], pricePaise: 100 }).success).toBe(false);
    expect(storeApplySchema.safeParse({ type: "stock", productId: P1, variantId: V(1), mode: "set", quantity: -1 }).success).toBe(false);
  });
});

describe("Tara store actions: model output and prompt", () => {
  it("keeps valid action proposals, coerces spoken numbers, drops junk", () => {
    const r = storeCopilotReplySchema.parse({
      answer: "Plan",
      proposals: [
        { type: "stock", productTitle: "Blue Kurti", variant: "M", mode: "set", quantity: "50" },
        { type: "price", productTitle: "Blue Kurti", priceRupees: "₹1,499" },
        { type: "stock", productTitle: "Blue Kurti" },
        { type: "teleport", productTitle: "x" },
      ],
    });
    expect(r.proposals).toHaveLength(2);
    expect(r.proposals[0]).toMatchObject({ type: "stock", quantity: 50 });
    expect(r.proposals[1]).toMatchObject({ type: "price", priceRupees: 1499 });
  });

  it("prompt: act, don't instruct; plan first; ask when unsure", () => {
    const p = storeCopilotPrompt({ storeName: "Aangan", language: "hi", snapshot: "Store: Aangan", messages: [{ role: "user", content: "Kurti ka stock 50 kar do" }] });
    expect(p.system).toMatch(/NEVER reply with steps for them to do it themselves/);
    expect(p.system).toMatch(/"type":"stock"/);
    expect(p.system).toMatch(/"type":"blog_post"/);
    expect(p.system).toMatch(/Press Do it below, or say yes/);
    expect(p.system).toMatch(/ask ONE short question instead of guessing/);
  });
});

describe("plan confirmation by voice / text", () => {
  it.each(["yes", "Haan", "haan kar do", "ok do it", "हाँ कर दो", "ji haan", "theek hai", "Yes please!", "kar do"])("'%s' runs the plan", (t) => {
    expect(isPlanConfirmation(t)).toBe(true);
  });
  it.each(["no", "nahi", "mat karo", "yes but change the price to 400", "haan, aur ek blog bhi likho", "", "don't do it", "stop"])("'%s' does not", (t) => {
    expect(isPlanConfirmation(t)).toBe(false);
  });
});

describe("informative Tara actions", () => {
  const current = {
    tagline: null,
    about: null,
    seo: { title: null, description: null },
    services: [
      { name: "Root canal", shortDescription: null, description: null, priceType: "STARTING_FROM" as const, pricePaise: 300_000, isActive: true },
      { name: "Teeth cleaning", shortDescription: null, description: null, priceType: "ON_REQUEST" as const, pricePaise: null, isActive: true },
    ],
  };

  it("service price and visibility become charged steps; unknown/no-op ones are dropped", () => {
    const proposals = [
      proposalSchema.parse({ kind: "service_price", serviceName: "root canal", priceType: "FIXED", priceRupees: "3500" }),
      proposalSchema.parse({ kind: "service_visibility", serviceName: "Teeth cleaning", visible: false }),
      proposalSchema.parse({ kind: "service_visibility", serviceName: "Root canal", visible: true }),
      proposalSchema.parse({ kind: "service_price", serviceName: "Braces", priceType: "FIXED", priceRupees: 100 }),
    ];
    const views = informativeProposalViews(proposals, current, { action: 2 });
    expect(views.map((v) => v.title)).toEqual(['Change the price of "root canal"', 'Hide "Teeth cleaning" on your website']);
    expect(views[0]!.fields[0]).toMatchObject({ label: "Price", before: "From ₹3,000", after: "₹3,500" });
    expect(views.every((v) => v.applyCredits === 2)).toBe(true);
    expect(proposalWrites(proposals[0]!)).toEqual({ servicePrice: { serviceName: "root canal", priceType: "FIXED", pricePaise: 350_000 } });
    // A fixed price without an amount becomes "on request", never ₹0.
    expect(proposalWrites(proposalSchema.parse({ kind: "service_price", serviceName: "x", priceType: "FIXED", priceRupees: null }))).toEqual({ servicePrice: { serviceName: "x", priceType: "ON_REQUEST", pricePaise: null } });
  });

  it("prompt: act, don't instruct", () => {
    const p = informativeCopilotPrompt({ businessName: "Smile Dental", language: "en", snapshot: "x", messages: [{ role: "user", content: "hide teeth cleaning" }] });
    expect(p.system).toMatch(/"kind":"service_price"/);
    expect(p.system).toMatch(/NEVER give them steps to do it themselves/);
  });
});
