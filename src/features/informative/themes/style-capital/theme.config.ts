import type { ThemeConfig } from "../types";

/** Style Capital — Personal brands and owner-led businesses. Palette and fonts from docs/informative/PLAN.md. */
export const styleCapital: ThemeConfig = {
  id: "style-capital",
  name: "Style Capital",
  tagline: "Your name, front and centre",
  bestFor: "Personal brands and owner-led businesses",
  recommendedCategories: [
    "personal_brand",
    "consultancy"
  ],
  demoCategory: "personal_brand",
  tokens: {
    colors: {
      primary: "#8C1C3A",
      secondary: "#111111",
      accent: "#8C1C3A",
      background: "#FAF7F2",
      surface: "#FFFFFF",
      text: "#111111",
      mutedText: "#55504A"
    },
    fonts: {
      heading: "dm-serif-display",
      body: "dm-sans"
    },
    radius: "none",
    shadow: "none",
    spacing: "airy",
    dark: false,
    headingCase: "normal"
  },
  layout: {
    header: "centered",
    hero: "split",
    servicesStyle: "list",
    gallery: "grid",
    testimonials: "quote",
    footer: "simple",
    motif: "signature"
  },
  defaultSections: [
    "hero",
    "about",
    "highlights",
    "services_list",
    "testimonials",
    "faq",
    "cta"
  ],
  motion: "subtle"
};
