import type { IndustrySlug } from "@/features/stores/industries";
import type { MarketplaceTheme, ThemePreset, ThemeStyle } from "../types";

/**
 * Business / brochure presets. These deliberately use service-led sections instead of product
 * grids: a seller can publish a complete informative site with their own pages, contact details
 * and enquiry CTAs. Applying one is still content-safe; existing section copy is reused by
 * applyThemePreset and the store can refine every section in the visual editor.
 */
const ADDED = "2026-10-19";

type Palette = { primary: string; secondary: string; accent: string; background: string; text: string; border: string; sale: string };
type InfoSpec = {
  key: string;
  name: string;
  tagline: string;
  description: string;
  industry: IndustrySlug;
  style: ThemeStyle;
  bestFor: [string, string, string];
  features: string[];
  demo: null;
  palette: Palette;
  heading: string;
  body: string;
  composition: 0 | 1 | 2 | 3 | 4;
};

const compositions: readonly ThemePreset["home"][] = [
  [
    ["Hero", { height: "large", overlay: 42, autoplay: 0, variant: "overlay" }],
    ["BrandStory", { variant: "split", tone: "light" }],
    ["TrustBadges", { layout: "grid", tone: "muted" }],
    ["EditorialImageText", { variant: "overlap", imagePosition: "right", tone: "light" }],
    ["Testimonials", { variant: "cards", tone: "muted" }],
    ["CallToAction", { variant: "cta-band", tone: "accent" }],
  ],
  [
    ["Hero", { height: "full", overlay: 35, autoplay: 0, variant: "split", panelTone: "light" }],
    ["TrustBadges", { layout: "grid", tone: "dark" }],
    ["BrandStory", { variant: "collage", tone: "light" }],
    ["Gallery", { variant: "gallery-masonry", tone: "light" }],
    ["FAQ", { variant: "accordion", limit: 6 }],
    ["ContactInfo", { variant: "contact-split", tone: "muted" }],
  ],
  [
    ["Hero", { height: "medium", overlay: 38, autoplay: 0, variant: "framed", panelTone: "muted" }],
    ["TrustBadges", { layout: "marquee", tone: "light" }],
    ["EditorialImageText", { variant: "split", imagePosition: "left", tone: "light" }],
    ["Team", { variant: "team-circles", tone: "muted" }],
    ["Testimonials", { variant: "cards", tone: "light" }],
    ["CallToAction", { variant: "cta-card", tone: "muted" }],
  ],
  [
    ["Hero", { height: "large", overlay: 48, autoplay: 0, variant: "hero-fade", slideNav: "dots" }],
    ["BrandStory", { variant: "band", tone: "light" }],
    ["TrustBadges", { layout: "grid", tone: "accent" }],
    ["Gallery", { variant: "gallery-grid", tone: "light" }],
    ["FAQ", { variant: "faq-numbered", limit: 5 }],
    ["ContactInfo", { variant: "contact-cards", tone: "light" }],
  ],
  [
    ["Hero", { height: "medium", overlay: 30, autoplay: 0, variant: "minimal", panelTone: "light" }],
    ["RichText", { variant: "richtext-columns", tone: "light" }],
    ["TrustBadges", { layout: "grid", tone: "muted" }],
    ["BlogPosts", { variant: "blog-featured", tone: "light", limit: 3 }],
    ["Testimonials", { variant: "cards", tone: "muted" }],
    ["CallToAction", { variant: "cta-image", tone: "dark" }],
  ],
];

function preset(spec: InfoSpec): ThemePreset {
  const consultationLabel = spec.key === "pan-pizza" ? "Book a table" : spec.key === "easy-loans" ? "Apply now" : spec.key === "medicare-clinic" ? "Book an appointment" : spec.key === "shinex-services" ? "Request a quote" : "Book a consultation";
  const services = spec.key === "medicare-clinic" ? ["Specialist care", "Modern diagnostics", "Patient-first support"]
    : spec.key === "easy-loans" ? ["Fast approvals", "Clear rates", "Expert guidance"]
      : spec.key === "wedding-wonders" ? ["Meaningful matches", "Trusted profiles", "Stories that last"]
        : spec.key === "pan-pizza" ? ["Wood-fired favourites", "Made fresh daily", "Tables for every gathering"]
          : ["Tailored guidance", "Trusted expertise", "Clear next steps"];
  const sectionCopy = (type: string): Record<string, unknown> => {
    switch (type) {
      case "Hero": return { slides: [{ eyebrow: spec.key === "global-vision" ? "Study · work · settle" : "Welcome", heading: spec.tagline, subheading: `A considered, personal approach from ${spec.name}.`, ctaLabel: consultationLabel, ctaHref: "/pages/contact", align: spec.style === "modern" ? "center" : "left", textTone: "light" }] };
      case "BrandStory": return { eyebrow: "Why choose us", heading: spec.name === "Global Vision" ? "Turning global ambitions into success" : "Built around your goals", body: "Every journey is different. Our experienced team brings practical knowledge, thoughtful service and clear communication from the first conversation onward.", ctaLabel: "Learn more", ctaHref: "/pages/about", stats: [{ value: "10+", label: "years of expertise" }, { value: "98%", label: "clients recommend us" }, { value: "1:1", label: "personal guidance" }] };
      case "TrustBadges": return { items: services.map((title, index) => ({ icon: ["secure", "handmade", "truck"][index]!, title, text: "Thoughtful support at every step." })) };
      case "EditorialImageText": return { eyebrow: "Our approach", heading: "Expertise that feels personal", body: "From your first question to the final detail, we make the process feel clear, calm and confidently managed.", ctaLabel: "Explore our services", ctaHref: "/pages/services" };
      case "Testimonials": return { heading: "Stories from our community", items: [{ quote: "Clear guidance, genuine care and a team that listened from day one.", author: "A valued client", location: "India", rating: 5 }, { quote: "Every detail felt considered. We always knew what came next.", author: "A happy customer", location: "India", rating: 5 }] };
      case "CallToAction": return { eyebrow: "Let’s talk", heading: "Ready for the next step?", subheading: `Tell ${spec.name} what you need and our team will be in touch.`, ctaLabel: consultationLabel, ctaHref: "/pages/contact" };
      case "FAQ": return { heading: "Questions, answered", source: "manual", items: [{ question: "How do I get started?", answer: `Send ${spec.name} a message and we will guide you through the next step.` }, { question: "When will you reply?", answer: "Our team usually replies within one working day." }], ctaLabel: consultationLabel, ctaHref: "/pages/contact" };
      case "ContactInfo": return { heading: "Let’s start a conversation", subheading: "Tell us a little about what you need. We usually reply within one working day.", hours: "Monday–Saturday, 10am–7pm" };
      case "RichText": return { heading: `Welcome to ${spec.name}`, body: "A thoughtful service begins with a real conversation. Explore our approach, meet our team and take the next step when you are ready.", ctaLabel: consultationLabel, ctaHref: "/pages/contact" };
      case "Gallery": return { heading: spec.key === "urbanistic-studio" || spec.key === "archgenius" ? "Selected work" : "Moments that matter" };
      case "Team": return { heading: "The people behind the work" };
      case "BlogPosts": return { heading: "Ideas and insights" };
      default: return {};
    }
  };
  const homeSeed = Object.fromEntries(compositions[spec.composition]!.map(([type], index) => [index, { type, settings: sectionCopy(type) }]));
  return {
    tokens: {
      colors: spec.palette,
      headingFont: spec.heading,
      bodyFont: spec.body,
      headingCase: spec.style === "bold" ? "uppercase" : "normal",
      buttonShape: spec.style === "modern" || spec.style === "bold" ? "pill" : "rounded",
      buttonVariant: spec.style === "minimal" ? "outline" : "solid",
      cardRadius: spec.style === "minimal" ? "sm" : "lg",
      containerWidth: spec.style === "editorial" ? "wide" : "default",
      spacing: spec.style === "minimal" ? "airy" : "comfortable",
      sectionHeadingAlign: spec.style === "modern" ? "center" : "left",
    },
    header: { sticky: true, showStoreName: true },
    headerLayout: spec.style === "luxury" || spec.style === "editorial" ? "logo-center" : "logo-left",
    inlineMenu: spec.style !== "bold",
    menuStyle: "bar",
    announcementTone: spec.style === "minimal" ? "light" : "dark",
    announcementMode: "static",
    productCard: { imageRatio: "landscape", textAlign: "left", badgeStyle: "minimal", showQuickAdd: false, showRating: false, showSizes: false, showBrand: false, secondImageOnHover: false },
    footerTone: spec.style === "minimal" ? "light" : "dark",
    hero: { align: spec.style === "modern" ? "center" : "left", textTone: "light" },
    home: compositions[spec.composition]!,
    informativeSeed: {
      homeTypes: compositions[spec.composition]!.map(([type]) => type).join(">"),
      announcement: { messages: [{ text: spec.key === "shinex-services" ? "Commercial & office cleaning · Enquire today" : `${spec.name} · ${consultationLabel.toLowerCase()} today`, href: "/pages/contact" }] },
      home: homeSeed,
      footer: { about: spec.tagline, showPaymentNote: false, newsletterText: "Practical advice, useful updates and thoughtful stories in your inbox." },
    },
  };
}

const specs: InfoSpec[] = [
  { key: "global-vision", name: "Global Vision", tagline: "Your trusted partner for study and immigration abroad", description: "A confident, enquiry-led consultancy layout with an outcome-led hero, clear credentials, counsellor story and conversion points for a first consultation.", industry: "general", style: "modern", bestFor: ["Study abroad", "Visa consultants", "Education services"], features: ["Consultation CTA", "Credential strip", "Counsellor story", "Enquiry-ready contact"], demo: null, palette: { primary: "#bd3029", secondary: "#7f231f", accent: "#f0a15a", background: "#fffaf7", text: "#281a1a", border: "#f1d8d2", sale: "#bd3029" }, heading: "grotesk", body: "modern-sans", composition: 0 },
  { key: "urbanistic-studio", name: "Urbanistic Studio", tagline: "Designed around the way you live", description: "An editorial interior-design website with full-width visual storytelling, project highlights, proof points and a focused consultation call to action.", industry: "furniture", style: "editorial", bestFor: ["Interior designers", "Architectural studios", "Home stylists"], features: ["Portfolio-forward hero", "Project gallery", "Studio story", "Consultation CTA"], demo: null, palette: { primary: "#176d83", secondary: "#123a42", accent: "#d3aa70", background: "#fbfbf8", text: "#172525", border: "#dbe6e5", sale: "#c25a3c" }, heading: "marcellus", body: "humanist-sans", composition: 1 },
  { key: "pan-pizza", name: "Pan Pizza", tagline: "Every slice tells a story", description: "A warm restaurant site for menus, table bookings and neighbourhood storytelling, with room for specials, social proof and direct contact.", industry: "gourmet", style: "heritage", bestFor: ["Restaurants", "Cafes", "Cloud kitchens"], features: ["Menu CTA", "Story section", "Guest testimonials", "Booking contact"], demo: null, palette: { primary: "#870a37", secondary: "#3b1119", accent: "#e5b24b", background: "#fffdf7", text: "#291519", border: "#f0dadd", sale: "#c72b24" }, heading: "classic-serif", body: "humanist-sans", composition: 2 },
  { key: "medicare-clinic", name: "Medicare", tagline: "Compassionate care backed by modern medicine", description: "A reassuring clinic website for departments, specialists, patient stories and appointments, designed for clear information on every screen.", industry: "health", style: "minimal", bestFor: ["Clinics", "Diagnostic centres", "Health practices"], features: ["Appointment CTA", "Care services", "Patient stories", "Contact panel"], demo: null, palette: { primary: "#359db0", secondary: "#1e6876", accent: "#83cdd6", background: "#ffffff", text: "#18353a", border: "#d8ecef", sale: "#d45a45" }, heading: "modern-sans", body: "modern-sans", composition: 3 },
  { key: "wedding-wonders", name: "Wedding Wonders", tagline: "Where love finds its perfect match", description: "A romantic service website with a member-style story, success moments, community proof and an elegant enquiry call to action.", industry: "fashion", style: "luxury", bestFor: ["Wedding planners", "Matrimony services", "Event specialists"], features: ["Romantic hero", "Member stories", "Testimonials", "Contact CTA"], demo: null, palette: { primary: "#851437", secondary: "#5f0f29", accent: "#b68a46", background: "#fff9f6", text: "#30131e", border: "#f2dce3", sale: "#bd3156" }, heading: "playfair", body: "humanist-sans", composition: 4 },
  { key: "archgenius", name: "Archgenius", tagline: "We design spaces people love to live in", description: "A crisp architecture portfolio with a project-led hero, capabilities, process, team expertise and a consultation invitation.", industry: "furniture", style: "minimal", bestFor: ["Architects", "Construction studios", "Urban designers"], features: ["Project gallery", "Capabilities band", "Studio team", "Discovery CTA"], demo: null, palette: { primary: "#121212", secondary: "#474747", accent: "#ea6b22", background: "#ffffff", text: "#171717", border: "#e6e6e6", sale: "#cf3f2b" }, heading: "classic-serif", body: "modern-sans", composition: 2 },
  { key: "easy-loans", name: "Easy Loans", tagline: "Your dream home is closer than you think", description: "A straightforward lending site with trust markers, service routes, transparent process and a strong apply-now enquiry path.", industry: "general", style: "modern", bestFor: ["Loan advisors", "Financial services", "Mortgage brokers"], features: ["Apply CTA", "Trust figures", "Service cards", "Advisor proof"], demo: null, palette: { primary: "#246bd4", secondary: "#123b83", accent: "#77b3ff", background: "#f7fbff", text: "#162c4d", border: "#d8e7fa", sale: "#d75a35" }, heading: "classic-serif", body: "modern-sans", composition: 3 },
  { key: "envoy-visa", name: "Envoy Visa", tagline: "Trusted visa guidance for every journey", description: "A clear, modern website for immigration advisors: country and coaching services, proven process, common questions and a direct consultation route.", industry: "general", style: "modern", bestFor: ["Visa agencies", "Migration advisors", "Career coaching"], features: ["Service overview", "Process story", "FAQ block", "Consultation contact"], demo: null, palette: { primary: "#1258b7", secondary: "#0b3977", accent: "#f2a01d", background: "#ffffff", text: "#102742", border: "#dae6f7", sale: "#df6b21" }, heading: "modern-sans", body: "modern-sans", composition: 2 },
  { key: "belle-curls", name: "Belle Curls", tagline: "Beauty, crafted with care", description: "A calm, premium salon and beauty studio website for services, practitioners, transformations and appointment requests.", industry: "beauty", style: "luxury", bestFor: ["Salons", "Beauty studios", "Wellness clinics"], features: ["Service story", "Gallery", "Client reviews", "Appointment CTA"], demo: null, palette: { primary: "#765315", secondary: "#4f3713", accent: "#d0a965", background: "#fffdf8", text: "#302817", border: "#eee3c8", sale: "#b4533c" }, heading: "playfair", body: "humanist-sans", composition: 2 },
  { key: "shinex-services", name: "ShineX", tagline: "Keep your workplace fresh, safe and productive", description: "A precise B2B services website for commercial cleaning, facility management and recurring service enquiries.", industry: "general", style: "bold", bestFor: ["Cleaning services", "Facility management", "B2B service teams"], features: ["Service-led hero", "Proof points", "Team expertise", "Quote CTA"], demo: null, palette: { primary: "#11688a", secondary: "#0c3f5a", accent: "#4bc1cf", background: "#f9feff", text: "#102b38", border: "#d4eaf0", sale: "#d35f36" }, heading: "grotesk", body: "modern-sans", composition: 4 },
];

export const INFORMATIVE_THEMES: MarketplaceTheme[] = specs.map((spec) => ({
  key: spec.key,
  name: spec.name,
  tagline: spec.tagline,
  description: spec.description,
  industry: spec.industry,
  style: spec.style,
  siteType: "informative",
  bestFor: spec.bestFor,
  features: spec.features,
  demo: spec.demo,
  version: "1.0.0",
  added: ADDED,
  preset: preset(spec),
}));
