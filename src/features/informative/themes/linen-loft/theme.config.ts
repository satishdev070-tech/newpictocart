import type { ThemeConfig } from "../types";

/** Linen Loft — Interior designers, architects, home stylists. Warm linen neutrals with deep olive, a minimal header, lots of white space and a masonry portfolio. */
export const linenLoft: ThemeConfig = {
  id: "linen-loft",
  name: "Linen Loft",
  tagline: "Minimal, airy and material-led",
  bestFor: "Interior designers, architects, home stylists",
  recommendedCategories: [
    "interior_design"
  ],
  demoCategory: "interior_design",
  tokens: {
    colors: {
      primary: "#3F4A3C",
      secondary: "#D9CFC1",
      accent: "#A0826D",
      background: "#FAF9F6",
      surface: "#F1EEE8",
      text: "#262622",
      mutedText: "#5E5B54"
    },
    fonts: {
      heading: "marcellus",
      body: "jost"
    },
    radius: "none",
    shadow: "none",
    spacing: "airy",
    dark: false,
    headingCase: "normal"
  },
  layout: {
    header: "minimal",
    hero: "split",
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
    "highlights",
    "testimonials",
    "team",
    "contact",
    "enquiry_form"
  ],
  motion: "subtle"
};
