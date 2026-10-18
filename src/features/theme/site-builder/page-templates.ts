import { defaultSettings } from "@/features/theme/sections/definitions";
import type { SectionInstance, SectionType } from "@/features/theme/sections/types";

/**
 * Starter layouts for "Add page" in the site builder (pure). Each template is a list of home-page
 * section types (including the page sections: ContactInfo, RichText, BlogPosts, Gallery, Team,
 * CallToAction) with defaulted settings plus starter copy; ops.addPage() gives every
 * section its id. Content is placeholder text the seller edits; no images are referenced, so
 * every section renders its own empty-image state until the seller uploads one.
 */

export type PageTemplate = {
  key: string;
  label: string;
  description: string;
  sections: Omit<SectionInstance, "id">[];
};

function sec(type: SectionType, settings: Record<string, unknown> = {}): Omit<SectionInstance, "id"> {
  return { type, settings: { ...defaultSettings(type), ...settings }, visibility: { desktop: true, mobile: true } };
}

/** A Hero with one slide (the default slide with new copy). */
function hero(heading: string, subheading: string, ctaLabel = "", ctaHref = "", extra: Record<string, unknown> = {}) {
  const base = defaultSettings("Hero") as { slides: Record<string, unknown>[] };
  return sec("Hero", { height: "medium", ...extra, slides: [{ ...base.slides[0], heading, subheading, ctaLabel, ctaHref }] });
}

export const BLANK_TEMPLATE: PageTemplate = { key: "blank", label: "Blank page", description: "Start from an empty page and add sections yourself.", sections: [] };

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    key: "about",
    label: "About",
    description: "Tell your story: a banner, who you are with key numbers, your values, the team and kind words from customers.",
    sections: [
      hero("Our story", "How a small idea became the brand you know today."),
      sec("BrandStory", {
        heading: "Who we are",
        body: "We started with a simple belief: everyday things should be made well and made to last. Today we work with a small team of makers to bring that belief to every piece we sell.",
        stats: [
          { value: "2015", label: "founded" },
          { value: "40+", label: "makers" },
          { value: "10k+", label: "happy customers" },
        ],
      }),
      sec("RichText", {
        variant: "richtext-columns",
        heading: "What we believe in",
        body: "Honest materials. We choose fabrics, woods and metals that age well and are kind to the people who work with them.\n\nFair work. Every maker we partner with is paid fairly and on time, and many have been with us since the start.\n\nMade to last. Each product is checked by hand before it reaches you, and we are here to help long after you order.",
      }),
      sec("Team", { heading: "The people behind the brand", variant: "team-circles" }),
      sec("Testimonials", {
        heading: "What our customers say",
        items: [
          { quote: "Beautifully made and arrived quicker than expected.", author: "Ananya", location: "Pune", rating: 5 },
          { quote: "You can feel the care that goes into every piece.", author: "Rahul", location: "Delhi", rating: 5 },
          { quote: "My go-to store for gifts now.", author: "Meera", location: "Bengaluru", rating: 5 },
        ],
      }),
      sec("CallToAction", { heading: "Find something you'll keep for years", text: "Browse the collection or write to us for help choosing.", ctaLabel: "Shop the collection", ctaHref: "/collections", secondaryLabel: "Contact us", secondaryHref: "/contact" }),
    ],
  },
  {
    key: "blogs",
    label: "Blogs",
    description: "A journal landing page: a short intro, your latest stories from the blog and a sign-up.",
    sections: [
      sec("RichText", {
        variant: "richtext-centered",
        eyebrow: "The journal",
        heading: "Stories from our studio",
        body: "Guides, behind-the-scenes notes and the people who make our products.",
      }),
      sec("BlogPosts", { heading: "Latest stories", variant: "blog-featured", limit: 4 }),
      sec("BlogPosts", { heading: "More to read", variant: "blog-grid", limit: 6, viewAllLabel: "All stories" }),
      sec("Newsletter", { heading: "Get new stories in your inbox" }),
    ],
  },
  {
    key: "collection",
    label: "Collection",
    description: "Showcase a range: a banner, your collections, the newest products and trust badges.",
    sections: [
      hero("The new collection", "Fresh designs, made in small batches.", "Shop now", "/collections"),
      sec("CollectionGrid", { heading: "Shop by collection" }),
      sec("ProductGrid", { heading: "New in", source: "newest", viewAllHref: "/collections" }),
      sec("TrustBadges"),
    ],
  },
  {
    key: "contact",
    label: "Contact",
    description: "Help customers reach you: your phone, email, address and map, quick answers and a WhatsApp button.",
    sections: [
      sec("ContactInfo", { variant: "contact-cards", heading: "Get in touch", subheading: "Questions about an order, sizes or bulk gifting? We usually reply within one working day." }),
      sec("FAQ", { heading: "Before you write", source: "store", limit: 4 }),
      sec("CallToAction", { variant: "cta-card", heading: "Prefer to chat?", text: "Message us on WhatsApp and we'll get back to you quickly.", ctaLabel: "Read our FAQ", ctaHref: "/faq", tone: "muted" }),
    ],
  },
  {
    key: "faq",
    label: "FAQ",
    description: "Answer common questions about orders, shipping and returns, with a link to contact you.",
    sections: [
      sec("FAQ", {
        heading: "Frequently asked questions",
        source: "manual",
        items: [
          { question: "How long does delivery take?", answer: "Most orders are delivered within 3–7 working days." },
          { question: "Do you offer cash on delivery?", answer: "Yes, cash on delivery is available on most PIN codes." },
          { question: "Can I return a product?", answer: "You can request a return within 7 days of delivery." },
          { question: "How do I track my order?", answer: "We send a tracking link by email and SMS once your order ships." },
        ],
      }),
      sec("BrandStory", {
        heading: "Still have a question?",
        body: "Our team is happy to help with anything not covered here.",
        variant: "centered",
        ctaLabel: "Contact us",
        ctaHref: "/contact",
      }),
    ],
  },
  {
    key: "gallery",
    label: "Gallery",
    description: "A photo gallery of your looks with captions, an Instagram-style feed and a scrolling strip.",
    sections: [
      sec("Gallery", { heading: "Gallery", subheading: "Moments from our studio and our customers.", variant: "gallery-masonry" }),
      sec("Gallery", { heading: "Behind the scenes", variant: "gallery-carousel", columns: 4, captions: "overlay" }),
      sec("SocialProof", { heading: "Seen on Instagram" }),
      sec("Marquee", { items: [{ text: "Tag us to be featured" }, { text: "New looks every week" }] }),
    ],
  },
  {
    key: "privacy",
    label: "Privacy Policy",
    description: "A plain policy page with an introduction and one section per topic. Review the wording before you publish.",
    sections: [
      sec("RichText", {
        heading: "Privacy policy",
        subheading: "Please replace this text with your own policy.",
        body: "This page explains what information we collect when you shop with us, how we use it and the choices you have.",
      }),
      sec("RichText", {
        heading: "Information we collect",
        body: "Your name, contact details and delivery address when you place an order, and basic usage data when you browse the store.",
      }),
      sec("RichText", {
        heading: "How we use it",
        body: "To process and deliver your orders, provide support and, if you agree, send you updates about our products.\n\nWe share details only with the partners needed to complete your order, such as payment and delivery providers.",
      }),
      sec("RichText", {
        heading: "Your choices",
        body: "You can ask us to update or delete your information, or unsubscribe from emails at any time. Write to us using the contact page with any question about this policy.",
        ctaLabel: "Contact us",
        ctaHref: "/contact",
      }),
    ],
  },
  {
    key: "shop",
    label: "Shop",
    description: "A shopping page: promo tiles, categories, best sellers, a featured band and trust badges.",
    sections: [
      sec("PromoBanner"),
      sec("CategoryGrid", { heading: "Shop by category" }),
      sec("ProductGrid", { heading: "Best sellers", source: "bestselling", viewAllHref: "/collections" }),
      sec("FeatureBand", { heading: "Just landed", featureHeading: "New this week" }),
      sec("TrustBadges"),
    ],
  },
  {
    key: "team",
    label: "Team",
    description: "Introduce the people behind the brand with photos, names, roles and a few numbers.",
    sections: [
      hero("Meet the team", "The people who design, make and pack every order."),
      sec("Team", {
        heading: "Our people",
        variant: "team-cards",
        members: [
          { name: "Asha", role: "Founder", bio: "Started the brand from her kitchen table in 2015.", imagePath: "", href: "" },
          { name: "Vikram", role: "Head of design", bio: "Turns sketches and old textiles into new collections.", imagePath: "", href: "" },
          { name: "Neha", role: "Customer care", bio: "Answers every message, usually within the hour.", imagePath: "", href: "" },
          { name: "Imran", role: "Packing and dispatch", bio: "Makes sure every parcel leaves on time.", imagePath: "", href: "" },
        ],
        columns: 4,
      }),
      sec("BrandStory", {
        heading: "Small team, big care",
        variant: "band",
        stats: [
          { value: "12", label: "people" },
          { value: "3", label: "cities" },
          { value: "1", label: "shared studio" },
        ],
      }),
      sec("CallToAction", { heading: "Want to work with us?", text: "We're always happy to hear from makers and designers.", ctaLabel: "Get in touch", ctaHref: "/contact" }),
    ],
  },
  {
    key: "why-us",
    label: "Why Us",
    description: "Make the case for your store: promises, numbers, reviews and a sign-up.",
    sections: [
      sec("TrustBadges"),
      sec("BrandStory", {
        heading: "Why shop with us",
        body: "Quality you can feel, prices that stay fair and a team that answers when you need help.",
        variant: "centered",
        stats: [
          { value: "4.8★", label: "average rating" },
          { value: "48h", label: "dispatch" },
          { value: "7 days", label: "easy returns" },
        ],
      }),
      sec("Testimonials", {
        heading: "Don't just take our word for it",
        variant: "cards",
        items: [
          { quote: "Great quality and the packaging was lovely.", author: "Priya", location: "Mumbai", rating: 5 },
          { quote: "Customer care sorted my exchange in a day.", author: "Karan", location: "Jaipur", rating: 5 },
        ],
      }),
      sec("Marquee", { items: [{ text: "Free shipping on prepaid orders" }, { text: "Cash on delivery" }, { text: "Easy returns" }] }),
      sec("Newsletter"),
    ],
  },
];

export function pageTemplate(key: string): PageTemplate | null {
  return key === BLANK_TEMPLATE.key ? BLANK_TEMPLATE : (PAGE_TEMPLATES.find((t) => t.key === key) ?? null);
}
