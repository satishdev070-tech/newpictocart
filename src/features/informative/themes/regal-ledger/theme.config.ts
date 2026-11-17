import type { ThemeConfig } from "../types";

/** Regal Ledger — Law firms, chartered accountants, tax and business consultants. Navy and bronze with a classic serif, a split hero, a list of practice areas and a columns footer. */
export const regalLedger: ThemeConfig = {
  id: "regal-ledger",
  name: "Regal Ledger",
  tagline: "Navy, serif and quietly authoritative",
  bestFor: "Law firms, chartered accountants, tax and business consultants",
  recommendedCategories: [
    "consultancy",
    "personal_brand"
  ],
  demoCategory: "consultancy",
  tokens: {
    colors: {
      primary: "#1B2A4A",
      secondary: "#8A6D3B",
      accent: "#8A6D3B",
      background: "#FFFFFF",
      surface: "#F4F2EC",
      text: "#1B2A4A",
      mutedText: "#4E5666"
    },
    fonts: {
      heading: "dm-serif-display",
      body: "dm-sans"
    },
    radius: "sm",
    shadow: "none",
    spacing: "comfortable",
    dark: false,
    headingCase: "normal"
  },
  layout: {
    header: "classic",
    hero: "split",
    servicesStyle: "list",
    gallery: "grid",
    testimonials: "quote",
    footer: "columns",
    motif: "none"
  },
  defaultSections: [
    "hero",
    "about",
    "services_list",
    "highlights",
    "team",
    "stats",
    "testimonials",
    "faq",
    "contact",
    "enquiry_form"
  ],
  motion: "none"
};
