import type { ThemeConfig } from "../types";

/** Iron Pulse — Gyms, CrossFit boxes, martial arts, personal trainers. Near-black with a signal red, uppercase condensed headings, a full-bleed hero and a stats strip. */
export const ironPulse: ThemeConfig = {
  id: "iron-pulse",
  name: "Iron Pulse",
  tagline: "Bold, dark and built for energy",
  bestFor: "Gyms, CrossFit boxes, martial arts, personal trainers",
  recommendedCategories: [
    "gym_fitness"
  ],
  demoCategory: "gym_fitness",
  tokens: {
    colors: {
      primary: "#E5383B",
      secondary: "#F4F4F5",
      accent: "#E5383B",
      background: "#0E0E10",
      surface: "#18181B",
      text: "#F4F4F5",
      mutedText: "#A1A1AA"
    },
    fonts: {
      heading: "oswald",
      body: "roboto"
    },
    radius: "none",
    shadow: "medium",
    spacing: "compact",
    dark: true,
    headingCase: "uppercase"
  },
  layout: {
    header: "transparent",
    hero: "fullBleedImage",
    servicesStyle: "deck",
    gallery: "grid",
    testimonials: "carousel",
    footer: "dark",
    motif: "stats-strip"
  },
  defaultSections: [
    "hero",
    "stats",
    "services_grid",
    "pricing",
    "about",
    "team",
    "gallery",
    "testimonials",
    "cta",
    "enquiry_form"
  ],
  motion: "lively"
};
