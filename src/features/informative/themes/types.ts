import { z } from "zod";
import { INFO_CATEGORY_IDS } from "../categories";
import { SECTION_TYPES } from "../sections";
import { FONT_KEYS } from "./fonts";

/**
 * Theme config contract (docs/informative/PLAN.md "Theme system design"). A theme is DATA: design
 * tokens + layout variants + default section order, rendered by one shared section library, so a
 * seller can switch themes without losing content. Validated in tests for all 11 themes.
 */
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const themeConfigSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/),
  name: z.string().min(2).max(40),
  tagline: z.string().min(2).max(80),
  bestFor: z.string().min(2).max(120),
  recommendedCategories: z.array(z.enum(INFO_CATEGORY_IDS)).min(1),
  /** Category whose demo content the onboarding preview and theme switcher show. */
  demoCategory: z.enum(INFO_CATEGORY_IDS),
  tokens: z.object({
    colors: z.object({ primary: hex, secondary: hex, accent: hex, background: hex, surface: hex, text: hex, mutedText: hex }),
    fonts: z.object({ heading: z.enum(FONT_KEYS), body: z.enum(FONT_KEYS) }),
    radius: z.enum(["none", "sm", "md", "lg", "xl"]),
    shadow: z.enum(["none", "soft", "medium", "glow"]),
    spacing: z.enum(["compact", "comfortable", "airy"]),
    dark: z.boolean(),
    /** Heading letter case (Ascent Peak uses uppercase condensed headings). */
    headingCase: z.enum(["normal", "uppercase"]).default("normal"),
  }),
  layout: z.object({
    header: z.enum(["classic", "centered", "transparent", "minimal"]),
    hero: z.enum(["split", "fullBleedImage", "carousel", "typographic"]),
    servicesStyle: z.enum(["grid", "list", "cards", "menu", "deck", "glass"]),
    gallery: z.enum(["grid", "masonry", "beforeAfter"]),
    testimonials: z.enum(["cards", "carousel", "quote"]),
    footer: z.enum(["simple", "columns", "dark"]),
    motif: z.enum(["none", "stats-strip", "mountain", "wave", "gold-rules", "neon-glow", "gradient", "signature"]),
  }),
  /** Home page section order for a new site. */
  defaultSections: z.array(z.enum(SECTION_TYPES)).min(3).max(14),
  motion: z.enum(["none", "subtle", "lively"]),
  /** Vibe Shift: accent palette per hero slide ("rotating palettes"). */
  palettes: z.array(z.object({ name: z.string(), accent: hex, surface: hex })).max(6).optional(),
});

export type ThemeConfig = z.infer<typeof themeConfigSchema>;
export type ThemeConfigInput = z.input<typeof themeConfigSchema>;
