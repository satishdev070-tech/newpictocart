import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_CONFIG } from "@/features/theme/default-theme";
import type { ThemeConfig } from "@/features/theme/schema/config";
import { MAX_SECTIONS_PER_GROUP } from "@/features/theme/schema/config";
import { SECTION_DEFINITIONS, defaultSettings } from "@/features/theme/sections/definitions";
import type { EditorField, SectionDefinition, SectionInstance, SectionType } from "@/features/theme/sections/types";
import { clearGroup, groupHasContent, isGroupOn, isGroupShown, itemGroups, itemHideField, itemLabel, partitionFields, primaryListField, sectionTabs, setGroupVisible, visibleFields } from "@/features/theme/site-builder/field-groups";
import { aiOutputSchema, aiSectionTypes, buildSectionPrompt, fallbackSettings, retryPrompt, sanitizeSectionSettings } from "@/features/theme/site-builder/ai-section";
import { COALESCE_MS, HISTORY_LIMIT, canRedo, canUndo, historyReducer, initHistory, isDirty } from "@/features/theme/site-builder/history";
import {
  addableTypes,
  canAddSection,
  changePlan,
  changedLists,
  copyItem,
  duplicateSection,
  findSection,
  insertSection,
  moveItem,
  moveSection,
  moveSectionTo,
  removeItem,
  removeSection,
  setSectionSettings,
  setSectionStyle,
  toggleHidden,
  updateItems,
} from "@/features/theme/site-builder/ops";
import { getList, setList, type ListKey } from "@/features/theme/site-builder/slots";

const DEFS = Object.values(SECTION_DEFINITIONS) as SectionDefinition[];
const IMG = "tenant/11111111-2222-3333-4444-555555555555/theme/photo.jpg";

const sec = (id: string, type: SectionType = "Hero"): SectionInstance => ({ id, type, settings: defaultSettings(type), visibility: { desktop: true, mobile: true } });
/** A config whose home template is exactly `sections`. */
const withHome = (sections: SectionInstance[]): ThemeConfig => setList(DEFAULT_THEME_CONFIG, "templates.home", sections);
const ids = (c: ThemeConfig, k: ListKey = "templates.home") => getList(c, k)!.map((s) => s.id);

// -----------------------------------------------------------------------------
// Field groups
// -----------------------------------------------------------------------------

describe("field groups", () => {
  it("puts every field of every definition in exactly one tab", () => {
    for (const def of DEFS) {
      const tabs = sectionTabs(def);
      const all = [...tabs.edit, ...tabs.design, ...tabs.settings, ...tabs.colors];
      expect(all.length, def.type).toBe(def.fields.length);
      expect(new Set(all).size, def.type).toBe(def.fields.length);
      for (const f of def.fields) expect(all, `${def.type}.${f.key}`).toContain(f);
    }
  });

  it("routes kinds to the expected tabs", () => {
    for (const def of DEFS) {
      const tabs = sectionTabs(def);
      for (const f of tabs.design) expect(f.kind === "select" && f.display === "variants", `${def.type}.${f.key}`).toBe(true);
      for (const f of def.fields) {
        if (f.kind === "select" && f.display === "variants") expect(tabs.design).toContain(f);
        if (f.kind === "color" && !f.showIf) expect(tabs.colors).toContain(f);
        if (["image", "video", "list", "multiPicker", "picker", "text"].includes(f.kind)) expect(tabs.edit, `${def.type}.${f.key}`).toContain(f);
      }
    }
    const hero = sectionTabs(SECTION_DEFINITIONS.Hero);
    expect(hero.design.map((f) => f.key)).toEqual(["variant"]);
    expect(hero.colors.map((f) => f.key)).toContain("panelTone");
    expect(hero.settings.map((f) => f.key)).toEqual(expect.arrayContaining(["height", "overlay", "autoplay", "mediaRatio"]));
    // The "counter" toggle controls the caption texts, so it sits with them on Edit.
    expect(hero.edit.map((f) => f.key)).toEqual(expect.arrayContaining(["slides", "counter", "footnote", "scrollLabel"]));
    const sale = sectionTabs(SECTION_DEFINITIONS.SaleBanner);
    expect(sale.colors.map((f) => f.key)).toEqual(["background", "textColor"]);
    const grid = sectionTabs(SECTION_DEFINITIONS.ProductGrid);
    expect(grid.settings.map((f) => f.key)).toEqual(expect.arrayContaining(["spacing", "cardRatio", "columns"]));
  });

  it("keeps a showIf controller on the same tab as its dependants", () => {
    for (const def of DEFS) {
      const tabs = sectionTabs(def);
      const tabOf = (k: string) => (Object.keys(tabs) as (keyof typeof tabs)[]).find((t) => tabs[t].some((f) => f.key === k));
      for (const f of def.fields) {
        if (!f.showIf) continue;
        const ctrl = def.fields.find((x) => x.key === f.showIf!.key);
        if (!ctrl || (ctrl.kind === "select" && ctrl.display === "variants")) continue;
        if (tabOf(f.key) === "edit") expect(tabOf(ctrl.key), `${def.type}.${f.key}`).toBe("edit");
      }
    }
    // "Products from" moves to Edit with its pickers.
    const grid = sectionTabs(SECTION_DEFINITIONS.ProductGrid);
    expect(grid.edit.map((f) => f.key)).toEqual(expect.arrayContaining(["source", "collectionId", "productIds", "ruleOnSale", "ruleMaxPrice"]));
  });

  it("partition is stable for a synthetic field list", () => {
    const fields: EditorField[] = [
      { kind: "text", key: "heading", label: "H", maxLength: 10 },
      { kind: "select", key: "layout", label: "L", display: "variants", options: [{ value: "grid", label: "Grid" }] },
      { kind: "select", key: "tone", label: "T", options: [{ value: "light", label: "Light" }] },
      { kind: "color", key: "bg", label: "B" },
      { kind: "number", key: "n", label: "N", min: 0, max: 3 },
      { kind: "toggle", key: "t", label: "T" },
      { kind: "select", key: "spacing", label: "S", options: [{ value: "default", label: "D" }] },
    ];
    const t = partitionFields(fields);
    expect(t.edit.map((f) => f.key)).toEqual(["heading"]);
    expect(t.design.map((f) => f.key)).toEqual(["layout"]);
    expect(t.colors.map((f) => f.key)).toEqual(["tone", "bg"]);
    expect(t.settings.map((f) => f.key)).toEqual(["n", "t", "spacing"]);
  });

  it("finds the primary list field", () => {
    expect(primaryListField(SECTION_DEFINITIONS.Hero)?.key).toBe("slides");
    expect(primaryListField(SECTION_DEFINITIONS.Testimonials)?.key).toBe("items");
    expect(primaryListField(SECTION_DEFINITIONS.EditorialImageText)?.key).toBe("thumbs");
    expect(primaryListField(SECTION_DEFINITIONS.MegaMenu)).toBeNull();
  });

  it("labels items from the first title-like text", () => {
    const hero = primaryListField(SECTION_DEFINITIONS.Hero)!;
    expect(itemLabel({ heading: "Diwali edit", eyebrow: "New" }, hero.fields, "Slide 1")).toBe("Diwali edit");
    expect(itemLabel({ heading: "  ", eyebrow: "New in" }, hero.fields, "Slide 1")).toBe("New in");
    expect(itemLabel({}, hero.fields, "Slide 1")).toBe("Slide 1");
    const faq = primaryListField(SECTION_DEFINITIONS.FAQ)!;
    expect(itemLabel({ question: "Do you ship?", answer: "Yes" }, faq.fields, "Q")).toBe("Do you ship?");
    const t = primaryListField(SECTION_DEFINITIONS.Testimonials)!;
    expect(itemLabel({ quote: "Lovely saree", author: "Asha" }, t.fields, "Review")).toBe("Lovely saree");
    expect(itemLabel({ text: "x".repeat(100) }, primaryListField(SECTION_DEFINITIONS.AnnouncementBar)!.fields, "M")).toHaveLength(60);
    const cats = primaryListField(SECTION_DEFINITIONS.CategoryGrid)!;
    expect(itemLabel({ id: "c1", label: "" }, cats.fields, "Item 1", (_f, v) => (v === "c1" ? "Sarees" : null))).toBe("Sarees");
  });

  it("groups item fields for the item editor", () => {
    const hero = primaryListField(SECTION_DEFINITIONS.Hero)!;
    const groups = itemGroups(hero.fields);
    const keys = Object.fromEntries(groups.map((g) => [g.id, g.fields.map((f) => f.key)]));
    expect(groups.map((g) => g.id)).toEqual(["subtitle", "title", "description", "media", "actions", "other"]);
    expect(keys.subtitle).toEqual(["eyebrow"]);
    expect(keys.title).toEqual(["heading", "headingAccent"]);
    expect(keys.description).toEqual(["subheading"]);
    expect(keys.media).toEqual(["imagePath", "mobileImagePath", "alt"]);
    expect(keys.actions).toEqual(["ctaLabel", "ctaHref"]);
    expect(keys.other).toEqual(["align", "textTone"]);
    expect(groups.find((g) => g.id === "other")!.toggle).toBe(false);
    // Every item field lands in exactly one group, for every list in every definition.
    for (const def of DEFS)
      for (const f of def.fields)
        if (f.kind === "list") expect(itemGroups(f.fields).flatMap((g) => g.fields).length, `${def.type}.${f.key}`).toBe(f.fields.length);
  });

  it("group toggles hide via show* flags without clearing text/media (Off→On round-trip)", () => {
    const hero = primaryListField(SECTION_DEFINITIONS.Hero)!;
    const groups = itemGroups(hero.fields);
    const title = groups.find((g) => g.id === "title")!;
    const description = groups.find((g) => g.id === "description")!;
    const media = groups.find((g) => g.id === "media")!;
    const actions = groups.find((g) => g.id === "actions")!;
    const item = {
      heading: "Festive edit",
      headingAccent: "a saree.",
      subheading: "Hand block printed in Jaipur",
      imagePath: "tenant/11111111-1111-4111-8111-111111111111/media/hero.jpg",
      mobileImagePath: "",
      alt: "Saree",
      ctaLabel: "Shop",
      ctaHref: "/collections/all",
      align: "left",
    };
    expect(isGroupOn(title, item)).toBe(true);
    expect(groupHasContent(actions, item)).toBe(true);

    const off = [title, description, media, actions].reduce((acc, g) => setGroupVisible(g, acc, false), item as Record<string, unknown>);
    expect(off).toMatchObject({
      heading: "Festive edit",
      headingAccent: "a saree.",
      subheading: "Hand block printed in Jaipur",
      imagePath: item.imagePath,
      alt: "Saree",
      ctaLabel: "Shop",
      ctaHref: "/collections/all",
      showTitle: false,
      showDescription: false,
      showMedia: false,
      showActions: false,
    });
    expect(isGroupOn(title, off)).toBe(false);
    expect(isGroupShown("title", off)).toBe(false);
    expect(isGroupShown("media", off)).toBe(false);

    const on = [title, description, media, actions].reduce((acc, g) => setGroupVisible(g, acc, true), off);
    expect(on.heading).toBe("Festive edit");
    expect(on.subheading).toBe("Hand block printed in Jaipur");
    expect(on.imagePath).toBe(item.imagePath);
    expect(on.ctaLabel).toBe("Shop");
    expect(isGroupOn(title, on)).toBe(true);
    expect(isGroupShown("title", on)).toBe(true);

    // Legacy clear helper still wipes (not used by the item editor Off path).
    const cleared = clearGroup(actions, item);
    expect(cleared).toEqual({ ...item, ctaLabel: "", ctaHref: "" });
  });

  it("Hero slide schema keeps show* flags and defaults them to true", () => {
    const parsed = SECTION_DEFINITIONS.Hero.schema.parse({
      slides: [{ heading: "Hi", showTitle: false, showMedia: false, imagePath: "", subheading: "Kept" }],
    });
    const sl = parsed.slides[0]!;
    expect(sl).toMatchObject({ heading: "Hi", subheading: "Kept", showTitle: false, showMedia: false, showDescription: true, showActions: true, showSubtitle: true });
    const legacy = SECTION_DEFINITIONS.Hero.schema.parse({ slides: [{ heading: "Old" }] }).slides[0]!;
    expect(legacy).toMatchObject({ showTitle: true, showDescription: true, showMedia: true, showActions: true, showSubtitle: true });
  });

  it("has no hide field in current item schemas (Hide is omitted)", () => {
    for (const def of DEFS) for (const f of def.fields) if (f.kind === "list") expect(itemHideField(f.fields), `${def.type}.${f.key}`).toBeNull();
    expect(itemHideField([{ kind: "toggle", key: "hidden", label: "Hidden" }])).toEqual({ key: "hidden", hiddenWhen: true });
    expect(itemHideField([{ kind: "toggle", key: "enabled", label: "On" }])).toEqual({ key: "enabled", hiddenWhen: false });
  });

  it("visibleFields respects showIf", () => {
    const f = SECTION_DEFINITIONS.ProductGrid.fields;
    expect(visibleFields(f, { source: "collection" }).some((x) => x.key === "collectionId")).toBe(true);
    expect(visibleFields(f, { source: "newest" }).some((x) => x.key === "collectionId")).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// AI section
// -----------------------------------------------------------------------------

describe("ai section", () => {
  it("offers only addable, non-singleton types for a list's group", () => {
    const home = aiSectionTypes("templates.home");
    expect(home).toContain("Testimonials");
    expect(home).not.toContain("PageContent");
    expect(home).not.toContain("Header");
    expect(home).not.toContain("Footer");
    expect(aiSectionTypes("layout.header")).not.toContain("Testimonials");
    expect(aiSectionTypes("pages.p123456789")).toContain("FAQ");
    expect(aiOutputSchema(home).safeParse({ type: "Header", settings: {} }).success).toBe(false);
    expect(aiOutputSchema(home).safeParse({ type: "FAQ" }).success).toBe(true);
  });

  it("builds a prompt with store context as data and no media fields", () => {
    const p = buildSectionPrompt({ prompt: "3 reviews about <b>sarees</b>", types: ["Testimonials", "FAQ"], store: { name: "Kala Weaves", tagline: "Handloom", storeCategory: "Fashion", categories: ["Sarees"] }, pageTitle: "Home" });
    expect(p.system).toContain("Testimonials");
    expect(p.system).toContain("items: array of");
    expect(p.system).not.toContain("imagePath");
    expect(p.user).toContain("<store_context>");
    expect(p.user).toContain("Kala Weaves");
    expect(p.user).not.toContain("<b>");
    expect(retryPrompt(p, ["items.0.quote: Too long"]).user).toContain("items.0.quote: Too long");
  });

  it("strips unknown keys and image paths, keeps valid copy", () => {
    const r = sanitizeSectionSettings("Testimonials", {
      heading: "Loved by 10,000 women",
      evil: "<script>",
      items: [{ quote: "Beautiful weave", author: "Asha", location: "Pune", rating: 5, extra: 1 }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.settings.heading).toBe("Loved by 10,000 women");
    expect(r.settings).not.toHaveProperty("evil");
    expect((r.settings.items as Record<string, unknown>[])[0]).not.toHaveProperty("extra");
    expect(SECTION_DEFINITIONS.Testimonials.schema.safeParse(r.settings).success).toBe(true);

    const hero = sanitizeSectionSettings("Hero", { slides: [{ heading: "Festive", imagePath: IMG, mobileImagePath: "https://evil.example/x.jpg" }] });
    expect(hero.ok).toBe(true);
    if (!hero.ok) return;
    const slide = (hero.settings.slides as Record<string, unknown>[])[0]!;
    expect(slide.heading).toBe("Festive");
    expect(slide.imagePath).toBe("");
    expect(slide.mobileImagePath).toBe("");

    const story = sanitizeSectionSettings("BrandStory", { heading: "Our story", imagePath: IMG });
    expect(story.ok && story.settings.imagePath).toBe("");
  });

  it("drops picker ids the model invents", () => {
    const r = sanitizeSectionSettings("ProductGrid", { heading: "Picks", source: "products", productIds: ["not-a-uuid"], collectionId: "x" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.settings.productIds).toEqual([]);
      expect(r.settings.collectionId).toBe("");
    }
  });

  it("reports issues for invalid settings and falls back field by field", () => {
    const raw = { heading: "Kind words", tone: "neon", items: "nope" };
    const r = sanitizeSectionSettings("Testimonials", { ...raw, tone: "neon" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.join(" ")).toContain("tone");
    const fb = fallbackSettings("Testimonials", raw);
    expect(fb.heading).toBe("Kind words");
    expect(fb.tone).toBe(defaultSettings("Testimonials").tone);
    expect(fb.items).toEqual(defaultSettings("Testimonials").items);
    expect(SECTION_DEFINITIONS.Testimonials.schema.safeParse(fb).success).toBe(true);
    expect(fallbackSettings("FAQ", null)).toEqual(defaultSettings("FAQ"));
  });
});

// -----------------------------------------------------------------------------
// History
// -----------------------------------------------------------------------------

describe("history reducer", () => {
  const c0 = DEFAULT_THEME_CONFIG;
  const step = (c: ThemeConfig, n: number) => setSectionStyle(c, "templates.home", getList(c, "templates.home")![0]!.id, { background: `#00000${n % 10}` });

  it("applies, undoes and redoes", () => {
    const c1 = step(c0, 1);
    const c2 = step(c1, 2);
    let s = initHistory(c0);
    expect(canUndo(s)).toBe(false);
    s = historyReducer(s, { type: "apply", config: c1, now: 0 });
    s = historyReducer(s, { type: "apply", config: c2, now: 5000 });
    expect(s.present).toBe(c2);
    s = historyReducer(s, { type: "undo" });
    expect(s.present).toBe(c1);
    expect(canRedo(s)).toBe(true);
    s = historyReducer(s, { type: "undo" });
    expect(s.present).toBe(c0);
    expect(historyReducer(s, { type: "undo" })).toBe(s);
    s = historyReducer(s, { type: "redo" });
    expect(s.present).toBe(c1);
    // A new edit clears the redo stack.
    s = historyReducer(s, { type: "apply", config: c2, now: 9000 });
    expect(canRedo(s)).toBe(false);
  });

  it("ignores no-op applies", () => {
    const s = initHistory(c0);
    expect(historyReducer(s, { type: "apply", config: c0 })).toBe(s);
  });

  it("coalesces same-key edits within the window only", () => {
    const c1 = step(c0, 1);
    const c2 = step(c1, 2);
    const c3 = step(c2, 3);
    let s = initHistory(c0);
    s = historyReducer(s, { type: "apply", config: c1, coalesce: "k", now: 1000 });
    s = historyReducer(s, { type: "apply", config: c2, coalesce: "k", now: 1000 + COALESCE_MS - 1 });
    expect(s.past).toEqual([c0]);
    expect(s.present).toBe(c2);
    s = historyReducer(s, { type: "apply", config: c3, coalesce: "k", now: 1000 + 3 * COALESCE_MS });
    expect(s.past).toEqual([c0, c2]);
    // A different key never merges.
    s = historyReducer(s, { type: "apply", config: c1, coalesce: "other", now: 1000 + 3 * COALESCE_MS + 1 });
    expect(s.past.length).toBe(3);
    // After undo the next edit is a new step.
    s = historyReducer(s, { type: "undo" });
    s = historyReducer(s, { type: "apply", config: c2, coalesce: "other", now: 1000 + 3 * COALESCE_MS + 2 });
    expect(s.past.length).toBe(3);
  });

  it("keeps at most HISTORY_LIMIT steps", () => {
    let s = initHistory(c0);
    let c = c0;
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) {
      c = { ...c };
      s = historyReducer(s, { type: "apply", config: c, now: i * 10_000 });
    }
    expect(s.past.length).toBe(HISTORY_LIMIT);
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) s = historyReducer(s, { type: "undo" });
    expect(s.past.length).toBe(0);
    expect(s.future.length).toBe(HISTORY_LIMIT);
  });

  it("tracks saved / dirty", () => {
    const c1 = step(c0, 1);
    let s = initHistory(c0);
    expect(isDirty(s)).toBe(false);
    s = historyReducer(s, { type: "apply", config: c1, now: 0 });
    expect(isDirty(s)).toBe(true);
    s = historyReducer(s, { type: "saved" });
    expect(isDirty(s)).toBe(false);
    expect(canUndo(s)).toBe(true);
    s = historyReducer(s, { type: "undo" });
    expect(isDirty(s)).toBe(true);
    // Structurally equal documents are not dirty.
    expect(isDirty({ ...s, present: structuredClone(s.saved) })).toBe(false);
    s = historyReducer(s, { type: "reset", config: c1 });
    expect(canUndo(s) || canRedo(s) || isDirty(s)).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// Ops
// -----------------------------------------------------------------------------

describe("ops", () => {
  const base = withHome([sec("sa00000001"), sec("sb00000001", "FAQ"), sec("sc00000001", "Testimonials")]);

  it("moves sections by delta and to an index", () => {
    expect(ids(moveSection(base, "templates.home", "sb00000001", -1))).toEqual(["sb00000001", "sa00000001", "sc00000001"]);
    expect(moveSection(base, "templates.home", "sa00000001", -1)).toBe(base);
    expect(ids(moveSectionTo(base, "templates.home", "sa00000001", 2))).toEqual(["sb00000001", "sc00000001", "sa00000001"]);
    expect(ids(moveSectionTo(base, "templates.home", "sa00000001", 99))).toEqual(["sb00000001", "sc00000001", "sa00000001"]);
  });

  it("duplicates, removes and toggles hidden", () => {
    const d = duplicateSection(base, "templates.home", "sb00000001");
    expect(d.newId).toMatch(/^s[a-z0-9]{9}$/);
    expect(ids(d.config)).toEqual(["sa00000001", "sb00000001", d.newId, "sc00000001"]);
    expect(findSection(d.config, "templates.home", d.newId!)!.settings).toEqual(findSection(base, "templates.home", "sb00000001")!.settings);
    expect(ids(removeSection(base, "templates.home", "sb00000001"))).toEqual(["sa00000001", "sc00000001"]);
    expect(removeSection(base, "templates.home", "nope")).toBe(base);
    const hidden = toggleHidden(base, "templates.home", "sa00000001");
    expect(findSection(hidden, "templates.home", "sa00000001")!.visibility).toEqual({ desktop: false, mobile: false });
    expect(findSection(toggleHidden(hidden, "templates.home", "sa00000001"), "templates.home", "sa00000001")!.visibility).toEqual({ desktop: true, mobile: true });
  });

  it("inserts relative to an anchor with settings over defaults", () => {
    const a = insertSection(base, "templates.home", "Newsletter", "sb00000001", "before", { heading: "Join" });
    expect(ids(a.config)).toEqual(["sa00000001", a.newId, "sb00000001", "sc00000001"]);
    const s = findSection(a.config, "templates.home", a.newId!)!;
    expect(s.settings.heading).toBe("Join");
    expect(s.settings.variant).toBe(defaultSettings("Newsletter").variant);
    expect(ids(insertSection(base, "templates.home", "FAQ", "sb00000001", "after").config)[2]).not.toBe("sc00000001");
    const end = insertSection(base, "templates.home", "FAQ", null, "after");
    expect(ids(end.config).at(-1)).toBe(end.newId);
    const top = insertSection(base, "templates.home", "FAQ", null, "before");
    expect(ids(top.config)[0]).toBe(top.newId);
    expect(insertSection(base, "templates.home", "Header", null, "after")).toEqual({ config: base, newId: null });
  });

  it("canAddSection respects groups, singletons and the list limit", () => {
    const header = getList(DEFAULT_THEME_CONFIG, "layout.header")!;
    const hasHeader = header.some((s) => s.type === "Header");
    expect(canAddSection(DEFAULT_THEME_CONFIG, "layout.header", "Header")).toBe(!hasHeader);
    expect(canAddSection(DEFAULT_THEME_CONFIG, "templates.home", "Header")).toBe(false);
    expect(canAddSection(DEFAULT_THEME_CONFIG, "templates.home", "Testimonials")).toBe(true);
    const product = withHome([]);
    const withMarker = setList(product, "templates.product", [sec("sp00000001", "PageContent")]);
    expect(canAddSection(withMarker, "templates.product", "PageContent")).toBe(false);
    const full = withHome(Array.from({ length: MAX_SECTIONS_PER_GROUP }, (_, i) => sec(`s${String(i).padStart(9, "0")}`, "FAQ")));
    expect(canAddSection(full, "templates.home", "FAQ")).toBe(false);
    expect(addableTypes(full, "templates.home")).toEqual([]);
    expect(addableTypes(base, "templates.home")).not.toContain("PageContent");
  });

  it("edits settings and style", () => {
    const c = setSectionSettings(base, "templates.home", "sb00000001", { heading: "Questions" });
    expect(findSection(c, "templates.home", "sb00000001")!.settings.heading).toBe("Questions");
    const styled = setSectionStyle(base, "templates.home", "sa00000001", { background: "#111111" });
    expect(findSection(styled, "templates.home", "sa00000001")!.style).toEqual({ background: "#111111", text: "", accent: "" });
    const reset = setSectionStyle(styled, "templates.home", "sa00000001", { background: "" });
    expect(findSection(reset, "templates.home", "sa00000001")).not.toHaveProperty("style");
  });

  it("list item helpers", () => {
    const xs = [{ a: 1 }, { a: 2 }, { a: 3 }];
    expect(moveItem(xs, 0, 2)).toEqual([{ a: 2 }, { a: 3 }, { a: 1 }]);
    expect(moveItem(xs, 0, 5)).toBe(xs);
    const copied = copyItem(xs, 1, 5);
    expect(copied).toEqual([{ a: 1 }, { a: 2 }, { a: 2 }, { a: 3 }]);
    expect(copied[2]).not.toBe(copied[1]);
    expect(copyItem(xs, 1, 3)).toBe(xs);
    expect(removeItem(xs, 0)).toEqual([{ a: 2 }, { a: 3 }]);
    expect(removeItem([{ a: 1 }], 0, 1)).toEqual([{ a: 1 }]);
    const c = updateItems(base, "templates.home", "sb00000001", "items", (items) => [...items, { question: "Q?", answer: "A" }]);
    const faqItems = findSection(c, "templates.home", "sb00000001")!.settings.items as unknown[];
    expect(faqItems.at(-1)).toEqual({ question: "Q?", answer: "A" });
  });

  it("changePlan: CSS-only token edits skip the server, header edits re-render header + footer only", () => {
    const recolour = { ...base, tokens: { ...base.tokens, colors: { ...base.tokens.colors, primary: "#123456" } } };
    expect(changePlan(base, recolour)).toEqual({ lists: [], css: true });
    expect(changePlan(base, { ...base, tokens: { ...base.tokens, headingFont: "playfair" } })).toEqual({ lists: [], css: true });
    expect(changePlan(base, { ...base, tokens: { ...base.tokens, sectionHeadingAlign: base.tokens.sectionHeadingAlign === "left" ? "center" : "left" } })).toEqual({ lists: [], css: true });
    expect(changePlan(base, { ...base, tokens: { ...base.tokens, imagery: "food" } }).lists).toBe("all");
    expect(changePlan(base, { ...base, header: { ...base.header, logoPosition: "right" } })).toEqual({ lists: ["layout.header", "layout.footer"], css: false });
    expect(changePlan(base, { ...base, header: { ...base.header, logoPath: "tenant/x/logo.png" } }).lists).toBe("all");
    const both = setSectionSettings(recolour, "templates.home", "sa00000001", { footnote: "y" });
    expect(changePlan(base, both)).toEqual({ lists: ["templates.home"], css: true });
    expect(changePlan(base, base)).toEqual({ lists: [], css: false });
  });

  it("changedLists reports only the lists that changed", () => {
    expect(changedLists(base, base)).toEqual([]);
    expect(changedLists(base, setSectionSettings(base, "templates.home", "sa00000001", { footnote: "x" }))).toEqual(["templates.home"]);
    // Tokens with the same values: nothing to re-render.
    expect(changedLists(base, { ...base, tokens: { ...base.tokens } })).toEqual([]);
    const footer = getList(base, "layout.footer")!;
    expect(changedLists(base, setList(base, "layout.footer", [...footer]))).toEqual(["layout.footer"]);
    const withPage: ThemeConfig = { ...base, pages: [{ id: "pabcdefghi", handle: "about", title: "About", seoTitle: "", seoDescription: "", socialImagePath: "", noindex: false, sections: [] }] };
    const editedPage: ThemeConfig = { ...withPage, pages: withPage.pages.map((p) => ({ ...p, sections: [sec("sd00000001", "FAQ")] })) };
    expect(changedLists(withPage, editedPage)).toEqual(["pages.pabcdefghi"]);
  });

  it("changedLists re-renders everything for theme-wide edits outside the section lists (Bugs 2.0 #11)", () => {
    // Embeds (WhatsApp button, back-to-top…) and renamed built-in pages are drawn on every page.
    expect(changedLists(base, { ...base, embeds: { ...base.embeds } })).toBe("all");
    expect(changedLists(base, { ...base, builtinTitles: { ...base.builtinTitles } })).toBe("all");
    // A page renamed (sections untouched) must still reach the canvas.
    const withPage: ThemeConfig = { ...base, pages: [{ id: "pabcdefghi", handle: "about", title: "About", seoTitle: "", seoDescription: "", socialImagePath: "", noindex: false, sections: [] }] };
    const renamed: ThemeConfig = { ...withPage, pages: withPage.pages.map((p) => ({ ...p, title: "About us" })) };
    expect(changedLists(withPage, renamed)).toBe("all");
    // Same document: nothing to send.
    expect(changedLists(withPage, withPage)).toEqual([]);
  });
});
