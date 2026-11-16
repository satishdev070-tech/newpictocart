import { describe, expect, it } from "vitest";
import { basicInfoStepSchema, completeDraftSchema } from "@/features/informative/onboarding/draft";
import { INFO_CATEGORIES } from "@/features/informative/categories";
import { PRICE_TYPE_LABELS } from "@/features/informative/pricing";
import { INFO_COPY_PARAMS, INFO_EN, infoCopy, infoErrorText } from "@/features/start/i18n/info-copy";
import { INFO_TRANSLATIONS } from "@/features/start/i18n/informative/index";
import { toTemplates } from "@/features/start/i18n/templates";
import { START_UI_LOCALES } from "@/features/start/supported-locales";
import { expectComplete } from "../start/i18n-helpers";

const EN_TEMPLATES = toTemplates(INFO_EN, INFO_COPY_PARAMS);
const KNOWN_ERRORS = new Set(Object.values(INFO_EN.errors));

describe("informative onboarding copy", () => {
  it("has a dictionary for every non-English onboarding locale", () => {
    expect(Object.keys(INFO_TRANSLATIONS).sort()).toEqual(START_UI_LOCALES.filter((l) => l !== "en-IN").sort());
  });

  it.each(START_UI_LOCALES.filter((l) => l !== "en-IN"))("%s has every key with placeholders preserved", (locale) => {
    expectComplete(EN_TEMPLATES, INFO_TRANSLATIONS[locale], locale);
  });

  it("matches the category and price-type labels it translates", () => {
    for (const c of INFO_CATEGORIES) expect(INFO_EN.categories[c.id]).toBe(c.label);
    expect(INFO_EN.priceTypes).toEqual(PRICE_TYPE_LABELS);
  });

  it("knows every Step 1 validation message, so each can be shown translated", () => {
    const bad = [
      {},
      { businessName: "A", category: "nope", phone: "123", email: "x", city: "P", slug: "a", tagline: "x".repeat(121), serviceType: "x".repeat(61) },
      { businessName: "x".repeat(81), category: "other", serviceTypeId: "custom", serviceType: "a", phone: "9876543210", whatsappSameAsPhone: false, whatsapp: "12", email: "a@b.test", city: "Pune", slug: "admin" },
    ];
    for (const input of bad) {
      const r = basicInfoStepSchema.safeParse({ businessName: "", category: "", phone: "", email: "", city: "", slug: "", ...input });
      expect(r.success).toBe(false);
      for (const issue of r.success ? [] : r.error.issues) expect(KNOWN_ERRORS, `${issue.path.join(".")}: ${issue.message}`).toContain(issue.message);
    }
    const r = completeDraftSchema.safeParse({ v: 1, basic: { businessName: "Calm", category: "other", phone: "9876543210", email: "a@b.test", city: "Pune", slug: "calm-x" }, themeId: "", services: Array(7).fill({ name: "x" }) });
    for (const issue of r.success ? [] : r.error.issues) expect(KNOWN_ERRORS, issue.message).toContain(issue.message);
  });

  it("translates known validation messages and passes unknown ones through", () => {
    const ta = infoCopy("ta-IN");
    expect(infoErrorText(ta, "Enter your city")).toBe(ta.errors.city);
    expect(infoErrorText(ta, "Enter your city")).not.toBe("Enter your city");
    expect(infoErrorText(ta, "Something new")).toBe("Something new");
    expect(infoErrorText(infoCopy("en-IN"), "Enter your city")).toBe("Enter your city");
  });

  it("builds function entries and falls back to English for unknown locales", () => {
    expect(infoCopy("xx-IN")).toBe(INFO_EN);
    for (const l of START_UI_LOCALES) {
      expect(infoCopy(l).basic.available("calm.pictocart.in"), l).toContain("calm.pictocart.in");
      expect(infoCopy(l).services.subAddUpTo(6), l).toContain("6");
    }
  });
});
