import type { ThemeConfig } from "../types";

/** Vibe Shift — Interior designers and studios. Palette and fonts from docs/informative/PLAN.md. */
export const vibeShift: ThemeConfig = {
  id: "vibe-shift",
  name: "Vibe Shift",
  tagline: "Every room, a new mood",
  bestFor: "Interior designers and studios",
  recommendedCategories: [
    "interior_design"
  ],
  demoCategory: "interior_design",
  tokens: {
    colors: {
      primary: "#A64E2B",
      secondary: "#4A5A6A",
      accent: "#7D8F69",
      background: "#FBF8F3",
      surface: "#F2ECE3",
      text: "#2B2622",
      mutedText: "#62574D"
    },
    fonts: {
      heading: "playfair",
      body: "lato"
    },
    radius: "none",
    shadow: "none",
    spacing: "airy",
    dark: false,
    headingCase: "normal"
  },
  layout: {
    header: "centered",
    hero: "carousel",
    servicesStyle: "list",
    gallery: "masonry",
    testimonials: "quote",
    footer: "simple",
    motif: "none"
  },
  defaultSections: [
    "hero",
    "about",
    "gallery",
    "services_list",
    "testimonials",
    "cta",
    "contact"
  ],
  motion: "subtle",
  palettes: [
    {
      name: "Sage",
      accent: "#7D8F69",
      surface: "#EEF1E8"
    },
    {
      name: "Terracotta",
      accent: "#C0643F",
      surface: "#F6E9E1"
    },
    {
      name: "Sand",
      accent: "#B89B72",
      surface: "#F4ECDF"
    },
    {
      name: "Slate",
      accent: "#4A5A6A",
      surface: "#E7EBEF"
    }
  ]
};
