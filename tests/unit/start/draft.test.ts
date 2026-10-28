import { describe, expect, it } from "vitest";
import {
  draftSubcategory,
  emptyStartDraft,
  parseStartDraft,
  START_DRAFT_STORAGE_KEY,
} from "@/features/start/draft/schema";
import { startPreviewHost } from "@/features/start/components/live-preview";
import { storefrontPreviewUrl } from "@/lib/platform/urls";

describe("start draft schema", () => {
  it("round-trips empty draft at v2 from lang", () => {
    const d = emptyStartDraft({ plan: "starter", theme: null });
    expect(d.v).toBe(2);
    expect(d.screen).toBe("lang");
    expect(d.business.subcategory).toBeNull();
    expect(d.business.productsServices).toBe("");
    expect(d.voice.facts.subcategory).toBeNull();
    expect(d.plan).toBe("starter");
    const again = parseStartDraft(d);
    expect(again).toEqual(d);
  });

  it("returns null for invalid payload", () => {
    expect(parseStartDraft({ v: 2 })).toBeNull();
    expect(parseStartDraft({ v: 2, screen: "nope" })).toBeNull();
    expect(parseStartDraft({ v: 1, screen: "nope" })).toBeNull();
  });

  it("migrates v1 drafts to v2 fields and screens", () => {
    const v1 = {
      v: 1,
      screen: "welcome",
      locale: "en-IN",
      intent: null,
      path: null,
      voice: {
        facts: { name: null, category: null, siteMode: null, tagline: null, city: null },
        done: false,
      },
      business: {
        name: "",
        tagline: "",
        category: null,
        city: "",
        whatsapp: "",
        siteMode: "ecommerce",
      },
      products: [],
      mood: null,
      accent: null,
      payment: { upi: "", cod: true, shipping: "free-over" },
      plan: null,
      theme: null,
      result: null,
    };
    const migrated = parseStartDraft(v1);
    expect(migrated?.v).toBe(2);
    expect(migrated?.screen).toBe("lang");
    expect(migrated?.business.subcategory).toBeNull();
    expect(migrated?.business.productsServices).toBe("");
    expect(migrated?.voice.facts.subcategory).toBeNull();
    expect(migrated?.voice.turns).toEqual([]);
  });

  it("remaps legacy v1 screens", () => {
    const base = emptyStartDraft();
    const asV1 = {
      ...base,
      v: 1 as const,
      business: {
        name: base.business.name,
        tagline: base.business.tagline,
        category: base.business.category,
        city: base.business.city,
        whatsapp: base.business.whatsapp,
        siteMode: base.business.siteMode,
      },
      voice: {
        facts: {
          name: null,
          category: null,
          siteMode: null,
          tagline: null,
          city: null,
        },
        done: false,
      },
    };
    expect(parseStartDraft({ ...asV1, screen: "intent" })?.screen).toBe("path");
    expect(parseStartDraft({ ...asV1, screen: "products" })?.screen).toBe("business");
    expect(parseStartDraft({ ...asV1, screen: "mood" })?.screen).toBe("theme");
    expect(parseStartDraft({ ...asV1, screen: "payment" })?.screen).toBe("theme");
    expect(parseStartDraft({ ...asV1, screen: "voice" })?.screen).toBe("business");
    expect(parseStartDraft({ ...asV1, screen: "quiz" })?.screen).toBe("business");
  });

  it("exports storage key constant", () => {
    expect(START_DRAFT_STORAGE_KEY).toBe("pictocart.start.draft.v1");
  });

  it("keeps drafts saved before the conversation history field", () => {
    const d = emptyStartDraft();
    const stored = { ...d, voice: { facts: d.voice.facts, done: false } };
    const again = parseStartDraft(stored);
    expect(again?.voice.turns).toEqual([]);
    expect(again?.voice.mode).toBe("talk");
  });

  it("resolves subcategory from business or voice facts", () => {
    const d = emptyStartDraft();
    d.business.category = "fashion";
    d.business.subcategory = "ethnic";
    expect(draftSubcategory(d)).toBe("ethnic");
    d.business.subcategory = null;
    d.voice.facts.category = "fashion";
    d.voice.facts.subcategory = "western";
    expect(draftSubcategory(d)).toBe("western");
  });

  it("loads the finished store on its own host", () => {
    expect(storefrontPreviewUrl("kia-garments.localhost", "http://localhost:3000")).toBe("http://kia-garments.localhost:3000/");
    expect(storefrontPreviewUrl("kia-garments.pictocart.in", "https://pictocart.in")).toBe("https://kia-garments.pictocart.in/");
  });

  it("uses the store slug in the preview address", () => {
    expect(startPreviewHost("Radhika Jewellers", "localhost")).toBe("radhika-jewellers.localhost");
  });
});
