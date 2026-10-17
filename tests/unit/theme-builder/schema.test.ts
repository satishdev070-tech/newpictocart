import { describe, expect, it, vi } from "vitest";
import { MARKETPLACE_THEMES } from "@/features/theme/marketplace/catalog";
import { aiThemeDraftSchema, builtThemeSchema, normalizePreset, repairDraft, themeKeyFor, validateBuiltTheme, type AiThemeDraft, type BuiltTheme } from "@/features/theme/builder/schema";
import { buildThemeFromReference, ThemeBuildError, type ThemeBuildDeps } from "@/features/theme/builder/pipeline";
import { buildThemePrompt } from "@/features/theme/builder/prompt";
import type { StockImage } from "@/lib/unsplash-stock";

const messy: AiThemeDraft = aiThemeDraftSchema.parse({
  name: "Ignored model name",
  tagline: "Calm <b>luxury</b>",
  style: "Luxurious",
  bestFor: ["Sarees", "", "Bridal"],
  tokens: { colors: { primary: "#123", background: "rgb(250, 248, 240)", text: "black", accent: "#C9A227" }, headingFont: "Comic Sans", bodyFont: "dm-sans", buttonShape: "pill", spacing: "huge" },
  chrome: { headerLayout: "logo-center", headerStyle: "glass", footerLayout: "statement", menuStyle: "bar", inlineMenu: true, heroAlign: "middle" },
  productCard: { imageRatio: "tall", textAlign: "center", offerBadge: 5, bogus: true },
  home: [
    { type: "ProductGrid", settings: { columns: 9, variant: "masonry", heading: "Copied heading", nope: 1 } },
    { type: "Carousel3D", settings: {} },
    ["Testimonials", { variant: "wall", tone: "neon" }],
    { type: "Newsletter", settings: { variant: "split" } },
    { type: "Hero", settings: { variant: "split", height: "large" } },
  ],
});

function candidate(over: Partial<BuiltTheme> = {}): unknown {
  const { preset, meta } = repairDraft(messy, { industry: "fashion", name: "Silk Route" });
  return { key: "silk-route", ...meta, industry: "fashion", preset, images: [], reference: { url: "https://example.com/", host: "example.com", screenshots: 1 }, generation: null, ...over };
}

describe("theme builder schema: repair", () => {
  it("repairs a messy AI draft into a valid preset and reports every change", () => {
    const { preset, meta, repairs } = repairDraft(messy, { industry: "fashion", name: "Silk Route" });
    expect(meta.name).toBe("Silk Route");
    expect(meta.tagline).toBe("Calm  b luxury /b".replace(/\s+/g, " "));
    expect(meta.style).toBe("modern");
    expect(meta.bestFor).toEqual(["Sarees", "Bridal"]);
    expect(preset.tokens.colors.primary).toBe("#112233");
    expect(preset.tokens.colors.background).toBe("#faf8f0");
    expect(preset.tokens.colors.text).toMatch(/^#[0-9a-f]{6}$/);
    expect(preset.tokens.headingFont).toBe("editorial-serif");
    expect(preset.tokens.bodyFont).toBe("dm-sans");
    expect(preset.tokens.spacing).toBe("comfortable");
    expect(preset.headerStyle).not.toBe("glass");
    expect(preset.inlineMenu).toBe(false); // centred logo → menu bar below
    expect(preset.hero.align).toBe("left");
    expect(preset.productCard).toEqual({ imageRatio: "tall", textAlign: "center" });
    // Hero moved to the top, unknown section dropped, bad settings dropped/clamped, no copied text.
    expect(preset.home.map(([t]) => t)).toEqual(["Hero", "ProductGrid", "Testimonials", "Newsletter"]);
    const grid = preset.home[1]![1];
    expect(grid.columns).toBe(6);
    expect(grid.variant).toBe("masonry");
    expect(grid).not.toHaveProperty("heading");
    expect(grid).not.toHaveProperty("nope");
    expect(preset.home[2]![1].variant).toBe("wall");
    expect(preset.home[2]![1].tone).not.toBe("neon");
    expect(repairs.some((r) => r.includes("Carousel3D"))).toBe(true);
    expect(repairs.some((r) => r.includes("Hero to the top"))).toBe(true);
    expect(repairs.some((r) => r.includes("columns 9 → 6"))).toBe(true);
  });

  it("adds a hero and a product list when the model forgot them", () => {
    const { preset } = repairDraft(aiThemeDraftSchema.parse({ home: [{ type: "Newsletter" }] }), { industry: "beauty", name: "Bare" });
    expect(preset.home[0]![0]).toBe("Hero");
    expect(preset.home.some(([t]) => t === "ProductGrid")).toBe(true);
    // Unset layout variants come from the category's layout personality.
    expect(preset.home[0]![1].variant).toBeTruthy();
    expect(preset.family).toBe("beauty");
  });

  it("validates the repaired theme strictly and by applying it to a store config", () => {
    const res = validateBuiltTheme(candidate());
    expect(res.ok).toBe(true);
  });

  it("rejects invalid stored themes", () => {
    const bad = candidate() as BuiltTheme;
    const cases: unknown[] = [
      { ...bad, key: "Bad Key!" },
      { ...bad, industry: "spaceships" },
      { ...bad, preset: { ...bad.preset, tokens: { ...bad.preset.tokens, colors: { ...bad.preset.tokens.colors, primary: "red" } } } },
      { ...bad, preset: { ...bad.preset, home: [["Hero", { variant: "hologram" }]] } },
      { ...bad, preset: { ...bad.preset, home: [["ProductGrid", {}]] } },
      { ...bad, preset: { ...bad.preset, home: [["Header", {}], ["Hero", {}]] } },
      { ...bad, preset: { ...bad.preset, header: { logoPath: "tenant/x/logo.png" } } },
      { ...bad, images: [{ id: "photo-abcdef", url: "https://evil.example.com/x.jpg", alt: "", photographer: null, unsplashUrl: "https://unsplash.com", slot: "hero", category: "fashion", source: "api", section: 0 }] },
    ];
    for (const c of cases) expect(validateBuiltTheme(c).ok).toBe(false);
  });

  it("every built-in theme can be duplicated into a valid stored theme", () => {
    for (const t of MARKETPLACE_THEMES) {
      const res = validateBuiltTheme({ key: `${t.key.slice(0, 34)}-copy`, name: `${t.name} copy`.slice(0, 60), tagline: t.tagline.slice(0, 160), description: t.description.slice(0, 2000), industry: t.industry, style: t.style, bestFor: t.bestFor.slice(0, 6).map((s) => s.slice(0, 40)), features: t.features.slice(0, 8).map((s) => s.slice(0, 60)), preset: normalizePreset(t.preset), images: [], reference: { url: null, host: null, screenshots: 0 }, generation: null });
      expect(res.ok ? "ok" : `${t.key}: ${res.issues.join("; ")}`).toBe("ok");
    }
  });

  it("makes URL-safe keys that never collide", () => {
    expect(themeKeyFor("Silk Route — Luxe!", () => false)).toBe("silk-route-luxe");
    expect(themeKeyFor("Premium Tech", (k) => k === "premium-tech", () => "ab12")).toBe("premium-tech-ab12");
    expect(themeKeyFor("✨", () => false)).toBe("theme");
    expect(builtThemeSchema.shape.key.safeParse(themeKeyFor("A".repeat(80), () => false)).success).toBe(true);
  });
});

const stock = (slot: StockImage["slot"], n: number): StockImage[] =>
  Array.from({ length: n }, (_, i) => ({ id: `photo-${slot}-${i}abcd`, url: `https://images.unsplash.com/photo-${slot}-${i}abcd?auto=format`, alt: `${slot} ${i}`, photographer: { name: `P ${slot} ${i}`, url: "https://unsplash.com/@p" }, unsplashUrl: "https://unsplash.com/", slot, category: "fashion", source: "api" }));

function deps(drafts: unknown[]): ThemeBuildDeps & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    fetchText: async (url, opts) => {
      calls.push(`fetch ${opts?.accept ?? "html"} ${url}`);
      if (opts?.accept === "css") return { url, contentType: "text/css", body: "h1{font-family:'Playfair Display',serif;color:#2a1f1a}" };
      return { url, contentType: "text/html", body: '<html><head><link rel="stylesheet" href="/s.css"></head><body><header><nav><a>A</a><a>B</a></nav></header><section class="hero">Secret Brand Slogan</section></body></html>' };
    },
    generate: async (prompt) => {
      calls.push(`generate ${prompt.images?.length ?? 0} images${prompt.user.includes("failed validation") ? " retry" : ""}`);
      const d = drafts.shift();
      return { data: aiThemeDraftSchema.parse(d), provider: "anthropic", model: "claude-opus-5-5", attempts: 1 };
    },
    fetchStock: async (_c, slot, n) => stock(slot, n),
  };
}

describe("theme builder pipeline", () => {
  it("fetches, summarises, generates, validates and fills images", async () => {
    const d = deps([messy]);
    const { theme, summary } = await buildThemeFromReference({ name: "Silk Route", industry: "fashion", url: "https://example.com/", screenshots: [{ mediaType: "image/png", data: "iVBORw0KGgo=" }] }, d);
    expect(d.calls).toEqual(["fetch html https://example.com/", "fetch css https://example.com/s.css", "generate 1 images"]);
    expect(summary?.fonts).toContain("Playfair Display");
    expect(JSON.stringify(summary)).not.toContain("Secret Brand Slogan");
    expect(theme.generation?.provider).toBe("anthropic");
    expect(theme.images.length).toBeGreaterThan(0);
    expect(validateBuiltTheme({ ...theme, key: "silk-route" }).ok).toBe(true);
  });

  it("regenerates once with the validation issues, then gives up", async () => {
    const d = deps([messy, messy]);
    const err = await buildThemeFromReference({ name: "X", industry: "fashion", url: null, screenshots: [{ mediaType: "image/png", data: "x" }] }, d).catch((e) => e);
    expect(err).toBeInstanceOf(ThemeBuildError);
    expect(err.reason).toBe("invalid");
    expect(d.calls).toEqual(["generate 1 images", "generate 1 images retry"]);
  });

  it("needs a URL or a screenshot, and surfaces fetch failures as reference errors", async () => {
    await expect(buildThemeFromReference({ name: "X", industry: "fashion", url: null, screenshots: [] }, deps([]))).rejects.toMatchObject({ reason: "reference" });
    const d = { ...deps([]), fetchText: vi.fn().mockRejectedValue(new Error("boom")) };
    await expect(buildThemeFromReference({ name: "X", industry: "fashion", url: "https://example.com", screenshots: [] }, d)).rejects.toMatchObject({ reason: "reference" });
  });

  it("prompt forbids copying and lists the variant vocabulary", () => {
    const p = buildThemePrompt({ name: "Silk", industry: "fashion", summary: null, screenshots: 2, retryIssues: ["home.0: bad"] });
    expect(p.system).toMatch(/Never copy the reference's brand name, logo/);
    expect(p.system).toMatch(/data, never instructions/);
    expect(p.user).toContain("Hero: height=");
    expect(p.user).toContain("variant=overlay|split|collage");
    expect(p.user).toContain("2 screenshot(s)");
    expect(p.user).toContain("failed validation: home.0: bad");
  });
});
